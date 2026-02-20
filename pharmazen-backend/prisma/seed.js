const { PrismaClient } = require('@prisma/client');
const Database = require('better-sqlite3');
const path = require('path');

const prisma = new PrismaClient();

// ── adjust this path to wherever your medicines.db lives ──────────────────
const DB_PATH = path.join(__dirname, '../../medicines.db');

function parsePrice(packageContainer) {
  if (!packageContainer) return 0.00;
  const match = packageContainer.match(/৳\s*([\d.]+)/);
  return match ? parseFloat(match[1]) : 0.00;
}

async function main() {
  const db = new Database(DB_PATH, { readonly: true });

  // ── 1. Build categories from drug_class ──────────────────────────────────
  console.log('Seeding categories...');
  const generics = db.prepare('SELECT generic_id, generic_name, drug_class FROM generics').all();

  const uniqueClasses = [...new Set(
    generics.map(g => g.drug_class?.trim() || 'Uncategorized')
  )];

  // insert all categories
  await prisma.category.createMany({
    data: uniqueClasses.map(name => ({ name })),
    skipDuplicates: true,
  });

  // fetch them back to build a name → id map
  const allCategories = await prisma.category.findMany();
  const categoryMap = Object.fromEntries(allCategories.map(c => [c.name, c.id]));

  // build generic_id → category_id map
  const genericToCategoryId = {};
  for (const g of generics) {
    const className = g.drug_class?.trim() || 'Uncategorized';
    genericToCategoryId[g.generic_id] = categoryMap[className];
  }

  console.log(`✓ ${allCategories.length} categories created`);

  // ── 2. Seed medicines in batches ─────────────────────────────────────────
  console.log('Seeding medicines...');
  const medicines = db.prepare('SELECT * FROM medicines').all();

  const BATCH_SIZE = 500;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < medicines.length; i += BATCH_SIZE) {
    const batch = medicines.slice(i, i + BATCH_SIZE);

    const data = batch
      .map(m => {
        const price = parsePrice(m.package_container);
        const categoryId = genericToCategoryId[m.generic_id] || categoryMap['Uncategorized'];

        if (!categoryId) { skipped++; return null; }

        const description = [
          m.generic_name || 'Unknown',
          m.dosage_form,
          m.strength,
          m.manufacturer,
        ].filter(Boolean).join(' | ');

        return {
          name: m.brand_name,
          description,
          categoryId,
          price,
          stockQuantity: 100,           // default stock
          requiresPrescription: m.isSensitive === 1,
          expiryDate: null,
        };
      })
      .filter(Boolean);

    await prisma.medicine.createMany({
      data,
      skipDuplicates: true,
    });

    inserted += data.length;
    process.stdout.write(`\r  Inserted ${inserted} / ${medicines.length}...`);
  }

  console.log(`\n✓ ${inserted} medicines inserted, ${skipped} skipped`);
  db.close();
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());