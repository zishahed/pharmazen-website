const { PrismaClient } = require('@prisma/client');
const Database = require('better-sqlite3');
const path = require('path');

// ── this app's SQLite asset, NOT the 6th-semester copy that seed.js reads ────
// Override with MEDICINES_DB_PATH when the two repos sit elsewhere.
const DEFAULT_DB_PATH = path.join(
  __dirname,
  '../../../../../7th semester/SDP II/project/pharmazen_mobile_app/assets/database/medicines.db'
);

const prisma = new PrismaClient();
const BATCH_SIZE = 500;
const APPLY = process.argv.includes('--apply');

// Columns Phase 1A added to `medicines`. Anything not listed here must not be
// touched: category_id, price, stock_quantity, expiry_date, requires_prescription
// and description belong to the website, not to the sync.
const SYNC_COLUMNS = [
  'genericId',
  'slug',
  'type',
  'dosageForm',
  'strength',
  'manufacturer',
  'packageContainer',
  'packageSize',
  'isSensitive',
];

/**
 * Byte-for-byte copy of seed.js:8-11. Neon's `price` column was produced by
 * this regex, so it is the only field on the server side that can be used to
 * tell two same-named SQLite rows apart. Do NOT "improve" it -- stripping the
 * thousands separators would change the parse and silently break the pairing.
 */
function parsePrice(packageContainer) {
  if (!packageContainer) return 0.00;
  const match = packageContainer.match(/৳\s*([\d.]+)/);
  return match ? parseFloat(match[1]) : 0.00;
}

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const toSnake = (c) => c.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());

function fsExists(p) {
  try {
    require('fs').accessSync(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reports which half of Phase 1A is live. A dry run is allowed against the
 * legacy schema so the join can be validated before the DDL is applied, but
 * writing is not -- Prisma would emit SQL for columns that do not exist yet.
 */
async function detectSchema() {
  const columns = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'medicines'
  `;
  const present = new Set(columns.map((c) => c.column_name));
  const required = SYNC_COLUMNS.map(toSnake).concat(['updated_at', 'is_deleted']);
  const missing = required.filter((c) => !present.has(c));

  const generics = await prisma.$queryRaw`
    SELECT to_regclass('public.generics')::text AS t
  `;
  const hasGenerics = Boolean(generics[0].t);

  if (!missing.length && hasGenerics) {
    return { ready: true, hasSyncColumns: true, hasGenerics };
  }

  const remedy =
    'Apply prisma/phase1a-sync-schema.sql to Neon first (additive, safe to run).';
  if (APPLY) {
    const absent = [
      ...missing.map((c) => `medicines.${c}`),
      ...(hasGenerics ? [] : ['table generics']),
    ];
    fail(`missing ${absent.join(', ')}\n  ${remedy}`);
  }

  return { ready: false, hasSyncColumns: false, hasGenerics, missing, remedy };
}

/**
 * `description` is what the React frontend searches on, so it must keep
 * matching whatever seed.js wrote, or website search silently degrades.
 */
function buildDescription(genericName, m) {
  return [genericName || 'Unknown', m.dosage_form, m.strength, m.manufacturer]
    .filter(Boolean)
    .join(' | ');
}

/**
 * Read the asset and index it by the natural key the two databases actually
 * share: (brand_name, description). `name` alone is not usable -- 5,190 of the
 * 21,715 rows share a brand_name with at least one other row.
 */
function readSource() {
  const dbPath = process.env.MEDICINES_DB_PATH || DEFAULT_DB_PATH;
  if (!fsExists(dbPath)) {
    fail(
      `SQLite asset not found at:\n  ${dbPath}\n` +
        '  Point MEDICINES_DB_PATH at the mobile app\'s assets/database/medicines.db.'
    );
  }

  const db = new Database(dbPath, { readonly: true });
  const generics = db.prepare('SELECT * FROM generics ORDER BY generic_id').all();
  const medicines = db.prepare('SELECT * FROM medicines ORDER BY brand_id').all();
  db.close();

  console.log(`✓ read ${generics.length} generics, ${medicines.length} medicines from`);
  console.log(`  ${dbPath}`);

  const genericNameById = new Map(generics.map((g) => [g.generic_id, g.generic_name]));

  // seed.js built `description` from the medicines.generic_name COLUMN, not
  // from a join to generics. Keying on the same column is what makes the join
  // to Neon reliable; keying on the joined name would miss a row whose two
  // copies of the name have drifted apart.
  const nameDrift = [];
  const groups = new Map();
  for (const m of medicines) {
    const genericName = m.generic_name ?? null;
    if (genericName !== (genericNameById.get(m.generic_id) ?? null)) {
      nameDrift.push({ brandId: m.brand_id, name: m.brand_name, column: m.generic_name, viaFk: genericNameById.get(m.generic_id) ?? null });
    }
    const key = `${m.brand_name}\u0000${buildDescription(genericName, m)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row: m, genericName });
  }

  return { generics, groups, nameDrift };
}

/**
 * Pair each SQLite group with its server-side group.
 *
 * Within a key group every row shares name, description, generic_name,
 * dosage_form, strength and manufacturer -- that is what the key *is*. The
 * remaining columns are checked at runtime: if `type`, `slug`, `isSensitive` or
 * `generic_id` ever differ inside a group, any pairing would be a guess and the
 * whole group is skipped.
 *
 * Only `package_container` / `package_size` are actually ambiguous, because
 * `price` is derived from the container and identical prices do not imply
 * identical text. Those two are informational (price is not synced), so an
 * unresolved pair writes them as NULL rather than guessing.
 */
function buildPlan(source, remoteRows) {
  const remoteGroups = new Map();
  for (const r of remoteRows) {
    const key = `${r.name}\u0000${r.description}`;
    if (!remoteGroups.has(key)) remoteGroups.set(key, []);
    remoteGroups.get(key).push(r);
  }

  const updates = [];
  const unresolved = [];
  const noRemoteMatch = [];
  const unsafeGroups = [];

  for (const [key, entries] of source.groups) {
    const remote = remoteGroups.get(key);

    if (!remote) {
      noRemoteMatch.push(...entries.map((e) => e.row.brand_id));
      continue;
    }
    if (remote.length !== entries.length) {
      noRemoteMatch.push(...entries.map((e) => e.row.brand_id));
      continue;
    }

    let safe = true;
    for (const col of ['generic_id', 'type', 'slug', 'isSensitive']) {
      const values = new Set(entries.map((e) => String(e.row[col])));
      if (values.size > 1) {
        unsafeGroups.push({ name: entries[0].row.brand_name, col });
        safe = false;
      }
    }
    if (!safe) continue;

    // Pair by price when it is unique inside the group; otherwise fall back to
    // insertion order and mark the packaging columns unreliable.
    const remoteByPrice = new Map();
    for (const r of remote) {
      const p = Number(r.price);
      if (!remoteByPrice.has(p)) remoteByPrice.set(p, []);
      remoteByPrice.get(p).push(r);
    }
    const priceIsUnique = remoteByPrice.size === entries.length;

    // A price tie is only a problem if the packaging text actually differs.
    // "30's pack" vs "100's pack" can share a price; two rows that share both
    // are interchangeable no matter which way they are paired.
    const packagingIsUniform =
      new Set(entries.map((e) => JSON.stringify([e.row.package_container, e.row.package_size]))).size === 1;
    const packagingReliable = priceIsUnique || packagingIsUniform;

    const sortedRemote = [...remote].sort((a, b) => a.id.localeCompare(b.id));
    const sortedEntries = [...entries].sort((a, b) => a.row.brand_id - b.row.brand_id);

    const pool = priceIsUnique ? remoteByPrice : new Map();
    const usedPrice = new Set();

    for (const entry of sortedEntries) {
      const price = parsePrice(entry.row.package_container);

      let match = null;

      if (priceIsUnique) {
        match = pool.get(price).shift();
      } else {
        match = sortedRemote.find((r) => !usedPrice.has(r.id));
      }

      if (!match) {
        noRemoteMatch.push(entry.row.brand_id);
        continue;
      }
      usedPrice.add(match.id);

      const data = {
        genericId: entry.row.generic_id ?? null,
        slug: entry.row.slug ?? null,
        type: entry.row.type ?? null,
        dosageForm: entry.row.dosage_form ?? null,
        strength: entry.row.strength ?? null,
        manufacturer: entry.row.manufacturer ?? null,
        isSensitive: entry.row.isSensitive === 1,
        packageContainer: packagingReliable ? entry.row.package_container ?? null : null,
        packageSize: packagingReliable ? entry.row.package_size ?? null : null,
      };

      updates.push({ id: match.id, name: entry.row.brand_name, data });

      if (!packagingReliable) {
        unresolved.push({
          brandId: entry.row.brand_id,
          name: entry.row.brand_name,
          remoteId: match.id,
        });
      }
    }
  }

  return { updates, unresolved, noRemoteMatch, unsafeGroups };
}

/** Skip rows whose sync columns already match, so a re-run does not bump
 *  `updated_at` and force every client to re-download the catalogue. */
function partitionNoop(updates, remoteRows) {
  const current = new Map(remoteRows.map((r) => [r.id, r]));
  const changed = [];
  let unchanged = 0;

  for (const u of updates) {
    const now = current.get(u.id);
    const differs =
      !now ||
      SYNC_COLUMNS.some((col) => !sameValue(now[col], u.data[col]));
    if (differs) changed.push(u);
    else unchanged++;
  }

  return { changed, unchanged };
}

function sameValue(a, b) {
  if (a instanceof Date) return a.toISOString() === b;
  return a === b;
}

async function syncGenerics(generics) {
  for (let i = 0; i < generics.length; i += BATCH_SIZE) {
    const batch = generics.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((g) =>
        prisma.generic.upsert({
          where: { genericId: g.generic_id },
          create: {
            genericId: g.generic_id,
            genericName: g.generic_name,
            slug: g.slug ?? null,
            monographLink: g.monograph_link ?? null,
            drugClass: g.drug_class ?? null,
            indication: g.indication ?? null,
            indicationDescription: g.indication_description ?? null,
            therapeuticClassDescription: g.therapeutic_class_description ?? null,
            pharmacologyDescription: g.pharmacology_description ?? null,
            dosageDescription: g.dosage_description ?? null,
            administrationDescription: g.administration_description ?? null,
            interactionDescription: g.interaction_description ?? null,
            contraindicationsDescription: g.contraindications_description ?? null,
            sideEffectsDescription: g.side_effects_description ?? null,
            pregnancyAndLactationDescription: g.pregnancy_and_lactation_description ?? null,
            precautionsDescription: g.precautions_description ?? null,
            pediatricUsageDescription: g.pediatric_usage_description ?? null,
            overdoseEffectsDescription: g.overdose_effects_description ?? null,
            durationOfTreatmentDescription: g.duration_of_treatment_description ?? null,
            reconstitutionDescription: g.reconstitution_description ?? null,
            storageConditionsDescription: g.storage_conditions_description ?? null,
            descriptionsCount: g.descriptions_count ?? 0,
          },
          update: {
            genericName: g.generic_name,
            slug: g.slug ?? null,
            monographLink: g.monograph_link ?? null,
            drugClass: g.drug_class ?? null,
            indication: g.indication ?? null,
            indicationDescription: g.indication_description ?? null,
            therapeuticClassDescription: g.therapeutic_class_description ?? null,
            pharmacologyDescription: g.pharmacology_description ?? null,
            dosageDescription: g.dosage_description ?? null,
            administrationDescription: g.administration_description ?? null,
            interactionDescription: g.interaction_description ?? null,
            contraindicationsDescription: g.contraindications_description ?? null,
            sideEffectsDescription: g.side_effects_description ?? null,
            pregnancyAndLactationDescription: g.pregnancy_and_lactation_description ?? null,
            precautionsDescription: g.precautions_description ?? null,
            pediatricUsageDescription: g.pediatric_usage_description ?? null,
            overdoseEffectsDescription: g.overdose_effects_description ?? null,
            durationOfTreatmentDescription: g.duration_of_treatment_description ?? null,
            reconstitutionDescription: g.reconstitution_description ?? null,
            storageConditionsDescription: g.storage_conditions_description ?? null,
            descriptionsCount: g.descriptions_count ?? 0,
          },
        })
      )
    );
    process.stdout.write(`\r  generics ${Math.min(i + BATCH_SIZE, generics.length)}/${generics.length}`);
  }
  process.stdout.write('\n');
}

async function syncMedicines(changed) {
  for (let i = 0; i < changed.length; i += BATCH_SIZE) {
    const batch = changed.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((u) => prisma.medicine.update({ where: { id: u.id }, data: u.data }))
    );
    process.stdout.write(`\r  medicines ${Math.min(i + BATCH_SIZE, changed.length)}/${changed.length}`);
  }
  process.stdout.write('\n');
}

async function main() {
  console.log(APPLY ? '▶ APPLYING to Neon' : '▶ DRY RUN — pass --apply to write\n');

  const schema = await detectSchema();
  if (schema.ready) {
    console.log('✓ target schema has the Phase 1A columns');
  } else {
    console.log(`⚠ ${schema.remedy}`);
    console.log('  Dry run can still validate the join; nothing will be written.');
  }

  const source = readSource();

  console.log('… reading server-side medicines');
  const remoteRows = await prisma.medicine.findMany({
    select: schema.hasSyncColumns
      ? {
          id: true,
          name: true,
          description: true,
          price: true,
          genericId: true,
          slug: true,
          type: true,
          dosageForm: true,
          strength: true,
          manufacturer: true,
          packageContainer: true,
          packageSize: true,
          isSensitive: true,
        }
      : { id: true, name: true, description: true, price: true },
  });
  console.log(`✓ ${remoteRows.length} medicines on the server`);

  const { updates, unresolved, noRemoteMatch, unsafeGroups } = buildPlan(source, remoteRows);
  const { changed, unchanged } = schema.hasSyncColumns
    ? partitionNoop(updates, remoteRows)
    : { changed: updates, unchanged: null };

  console.log(`\n── plan ──────────────────────────────`);
  console.log(`  generics to upsert      ${source.generics.length}`);
  console.log(`  medicines matched       ${updates.length} / ${source.groups.size} keys`);
  console.log(`  medicines to write      ${changed.length}`);
  if (unchanged !== null) console.log(`  already up to date      ${unchanged}`);
  console.log(`  unmatched brand_id      ${noRemoteMatch.length}`);
  console.log(`  ambiguous packaging     ${unresolved.length}`);

  if (unsafeGroups.length > 0) {
    console.log(`\n  ${unsafeGroups.length} group(s) skipped -- sync columns are not constant inside the key:`);
    for (const g of unsafeGroups) console.log(`    ${g.name} (${g.col})`);
  }

  if (unresolved.length > 0) {
    console.log(
      `\n  ! ${unresolved.length} row(s) share a brand name, description and price with another row,\n` +
        '    so package_container/package_size cannot be attributed. They will be written as\n' +
        '    NULL. Every other sync column is still correct -- price is not synced.'
    );
    for (const u of unresolved) console.log(`      brand_id=${u.brandId}  ${u.name}`);
  }

  if (noRemoteMatch.length > 0) {
    console.log(`\n  ! ${noRemoteMatch.length} brand_id(s) had no single server row to pair with:`);
    for (const id of noRemoteMatch) console.log(`      brand_id=${id}`);
  }

  const nullGeneric = [...source.groups.values()]
    .flat()
    .filter((e) => e.row.generic_id == null)
    .map((e) => e.row.brand_id);
  if (nullGeneric.length > 0) {
    console.log(
      `\n  ! ${nullGeneric.length} row(s) have no generic_id in the asset and will keep` +
        '\n    generic_id = NULL. The mobile client creates a stub generics row for these.'
    );
    for (const id of nullGeneric) console.log(`      brand_id=${id}`);
  }

  if (source.nameDrift.length > 0) {
    console.log(
      `\n  ! ${source.nameDrift.length} row(s) where medicines.generic_name disagrees with the` +
        '\n    generics row its generic_id points at. generic_id is written from the column,'
    );
    for (const d of source.nameDrift) {
      console.log(`      brand_id=${d.brandId}  ${d.name}  column=${JSON.stringify(d.column)} viaFk=${JSON.stringify(d.viaFk)}`);
    }
  }

  if (!APPLY) {
    console.log('\n── nothing was written. Re-run with --apply to execute. ──\n');
    return;
  }

  console.log('\n── applying ──────────────────────────');
  await syncGenerics(source.generics);
  console.log(`✓ ${source.generics.length} generics upserted`);
  await syncMedicines(changed);
  console.log(`✓ ${changed.length} medicines updated`);
  console.log('\n── done ──────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());