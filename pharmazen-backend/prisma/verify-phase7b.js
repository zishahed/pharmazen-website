#!/usr/bin/env node
/**
 * Phase 7b deploy verification.
 *
 * Runs every item on the DEPLOY CHECKLIST against a live API and prints
 * PASS/FAIL. Replaces running the checklist by hand, which needs a browser, a
 * pharmacist account, a customer account, a populated cart, and enough patience
 * to do it twice in the right order.
 *
 * WHAT IT TOUCHES
 *   Creates one throwaway customer, one cart, a few prescriptions and a few
 *   orders, then deletes all of them. It deliberately does NOT reuse a real
 *   customer's cart -- the production cart is real data, and overwriting it to
 *   run a test would be its own kind of bug. Everything it creates is tagged
 *   `phase7b-verify` and cleaned up in a finally block, so even a mid-run crash
 *   leaves it removable by `--cleanup-only`.
 *
 *   Fixture rows are written directly with Prisma rather than through the API,
 *   because the prescription *upload* endpoint requires a real file and a
 *   Cloudinary round trip. Everything under test is still exercised over HTTP --
 *   only the setup is shortcut.
 *
 * BEFORE YOU RUN IT
 *   Deploy the Phase 7b code first. This script fails loudly and early if the
 *   API does not yet expose the new fields, rather than reporting confusing
 *   failures further down.
 *
 * USAGE
 *   node prisma/verify-phase7b.js --yes
 *   API_BASE_URL=http://localhost:3000 node prisma/verify-phase7b.js --yes
 *   node prisma/verify-phase7b.js --cleanup-only
 *
 * Env: DATABASE_URL (from .env), API_BASE_URL (default: the deployed API),
 *      ADMIN_EMAIL / ADMIN_PASSWORD (default: the seeded admin account).
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { generateAccessToken } = require('../src/utils/jwt');

const prisma = new PrismaClient();

const API = (
  process.env.API_BASE_URL || 'https://pharmazen-backend.vercel.app/api'
).replace(/\/$/, '');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@pharmazen.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const TAG = 'phase7b-verify';
const TEST_EMAIL = `${TAG}-${Date.now()}@example.invalid`;

const results = [];
let failed = 0;

function check(name, passed, detail) {
  results.push({ name, passed, detail });
  if (!passed) failed += 1;
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${name}${detail ? ` -- ${detail}` : ''}`);
}

async function api(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body is a failure in itself; json stays null */
  }
  return { status: res.status, json };
}

const tokenFor = (user) =>
  generateAccessToken({ id: user.id, email: user.email, role: user.role });

/* -------------------------------------------------------------------------- */
/* Fixture                                                                     */
/* -------------------------------------------------------------------------- */

async function cleanup() {
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (!user) {
    console.log('Nothing to clean up.');
    return;
  }

  // Order first: Order.userId has no onDelete, so it defaults to RESTRICT and
  // would block deleting the user.
  await prisma.order.deleteMany({ where: { userId: user.id } });
  await prisma.prescription.deleteMany({ where: { userId: user.id } });
  await prisma.cart.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log(`Removed test user ${TEST_EMAIL} and all its rows.`);
}

async function buildFixture() {
  const medicines = await prisma.medicine.findMany({
    where: { isSensitive: true, isDeleted: false },
    orderBy: { name: 'asc' },
    take: 2,
    select: { id: true, name: true },
  });

  if (medicines.length < 2) {
    throw new Error(
      `Need 2 sensitive medicines to test the multi-medicine case, found ${medicines.length}.`
    );
  }

  // A throwaway customer, so no real cart is disturbed.
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      name: 'Phase 7b verification (temporary)',
      // Not a real credential; this account is deleted at the end of the run.
      // Login is not under test, so a placeholder satisfies the column.
      passwordHash: '$2a$12$0000000000000000000000000000000000000000000000000000',
      role: 'customer',
    },
  });

  const cart = await prisma.cart.create({ data: { userId: user.id } });

  const setCart = async (medicinesAndQuantities) => {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    for (const { id, quantity } of medicinesAndQuantities) {
      await prisma.cartItem.create({
        data: { cartId: cart.id, medicineId: id, quantity },
      });
    }
  };

  // A prescription approved and in-date right now, with a 2-unit budget.
  const inDateRange = {
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };

  const approvedFor = async (medicine) =>
    prisma.prescription.create({
      data: {
        userId: user.id,
        medicineId: medicine.id,
        medicineName: medicine.name,
        ...inDateRange,
        status: 'approved',
        maxQuantity: 2,
      },
    });

  // Five separate pending prescriptions: a prescription can only be reviewed
  // once, so each validation check needs its own.
  const pendingFor = (medicine) =>
    prisma.prescription.create({
      data: {
        userId: user.id,
        medicineId: medicine.id,
        medicineName: medicine.name,
        ...inDateRange,
        status: 'pending',
      },
    });

  return {
    user,
    cart,
    token: tokenFor(user),
    medicines,
    setCart,
    approvedFor,
    pendingFor,
  };
}

/* -------------------------------------------------------------------------- */
/* Checks                                                                      */
/* -------------------------------------------------------------------------- */

async function run(fx) {
  const [medOne, medTwo] = fx.medicines;
  const getRx = (id) => prisma.prescription.findUnique({ where: { id } });

  // Two identities, on purpose. Review is pharmacist/admin-only, but an order
  // must be placed by the customer who owns the cart -- createOrderFromCart
  // reads req.user.id, so signing in as the admin would build an order from the
  // admin's cart and fail with "Cart is empty" instead of testing anything.
  const asCustomer = { token: fx.token };
  const asPharmacist = { token: fx.adminToken };

  // -- Preflight: is the new code actually deployed? -------------------------
  console.log('\nPreflight');
  const probe = await fx.approvedFor(medOne);
  const probeRx = await api('GET', `/prescriptions/${probe.id}`, asPharmacist);
  const deployed =
    probeRx.status === 200 &&
    probeRx.json?.data &&
    probeRx.json.data.maxQuantity === 2 &&
    typeof probeRx.json.data.remainingQuantity === 'number';

  check(
    'API is running the Phase 7b code',
    deployed,
    deployed
      ? 'maxQuantity/remainingQuantity present'
      : `GET /prescriptions/:id returned ${probeRx.status} without the new fields -- deploy the code before verifying`
  );

  if (!deployed) {
    await prisma.prescription.delete({ where: { id: probe.id } });
    return;
  }

  // -- Review endpoint validation -------------------------------------------
  console.log('\nReview endpoint: pharmacist sets the limit');

  const ok30 = await fx.pendingFor(medOne);
  const r30 = await api('PUT', `/prescriptions/${ok30.id}/review`, {
    ...asPharmacist,
    body: { status: 'approved', maxQuantity: 30 },
  });
  check(
    'PUT review maxQuantity:30 -> 200 and stores 30',
    r30.status === 200 && r30.json?.data?.maxQuantity === 30,
    `status=${r30.status} maxQuantity=${r30.json?.data?.maxQuantity}`
  );

  for (const [label, value] of [
    ['maxQuantity:0', 0],
    ['maxQuantity:-5', -5],
    ['maxQuantity:99999', 99999],
  ]) {
    const pending = await fx.pendingFor(medOne);
    const res = await api('PUT', `/prescriptions/${pending.id}/review`, {
      ...asPharmacist,
      body: { status: 'approved', maxQuantity: value },
    });
    check(
      `PUT review ${label} -> 400`,
      res.status === 400,
      `status=${res.status} (a 500 or a silent 0 would both be wrong)`
    );
    await prisma.prescription.delete({ where: { id: pending.id } });
  }

  const omitted = await fx.pendingFor(medOne);
  const rOmit = await api('PUT', `/prescriptions/${omitted.id}/review`, {
    ...asPharmacist,
    body: { status: 'approved' },
  });
  check(
    'PUT review with no maxQuantity -> 200, falls back to the default',
    rOmit.status === 200 && rOmit.json?.data?.maxQuantity === 5,
    `status=${rOmit.status} maxQuantity=${rOmit.json?.data?.maxQuantity}`
  );

  // -- Order gate ------------------------------------------------------------
  console.log('\nOrder gate: the limit is enforced');

  // Clean slate: one approved 2-unit prescription for med one, cart asks for 2.
  await prisma.prescription.deleteMany({ where: { userId: fx.user.id } });
  const rx = await fx.approvedFor(medOne);
  await fx.setCart([{ id: medOne.id, quantity: 2 }]);

  const g1 = await api('GET', `/prescriptions/${rx.id}`, asPharmacist);
  check(
    'GET prescription shows max / used / remaining',
    g1.status === 200 &&
      g1.json.data.maxQuantity === 2 &&
      g1.json.data.consumedQuantity === 0 &&
      g1.json.data.remainingQuantity === 2,
    `max=${g1.json?.data?.maxQuantity} used=${g1.json?.data?.consumedQuantity} remaining=${g1.json?.data?.remainingQuantity}`
  );

  const order1 = await api('POST', '/orders', asCustomer);
  check(
    'POST /orders succeeds and consumes the units',
    order1.status === 200,
    `status=${order1.status} message=${order1.json?.message || ''}`
  );

  const afterFirst = await getRx(rx.id);
  check(
    'consumed_quantity incremented by the ordered amount',
    afterFirst.consumedQuantity === 2,
    `consumed=${afterFirst.consumedQuantity} expected=2`
  );

  const order2 = await api('POST', '/orders', asCustomer);
  const msg2 = order2.json?.message || '';
  check(
    'second POST /orders is rejected as exhausted',
    order2.status === 409 && /prescription/i.test(msg2) && /used up/i.test(msg2),
    `status=${order2.status} message="${msg2.slice(0, 80)}"`
  );
  check(
    'the rejection tells the client the prescription is exhausted',
    order2.json?.prescriptionExhausted === true,
    `prescriptionExhausted=${order2.json?.prescriptionExhausted}`
  );
  check(
    'the rejection message still contains "prescription" (CheckoutPage.jsx:59)',
    /prescription/i.test(msg2),
    'the React banner is gated on this substring'
  );

  const afterSecond = await getRx(rx.id);
  check(
    'the rejected order consumed nothing extra',
    afterSecond.consumedQuantity === 2,
    `consumed=${afterSecond.consumedQuantity} (must still be 2)`
  );

  // -- Cancellation returns the units ---------------------------------------
  console.log('\nCancellation returns the units');

  const orderId = order1.json?.data?.id;
  const cancel1 = await api('PUT', `/orders/${orderId}/cancel`, asCustomer);
  check(
    'PUT cancel -> 200',
    cancel1.status === 200,
    `status=${cancel1.status}`
  );

  const afterCancel = await getRx(rx.id);
  check(
    'units are returned to the prescription',
    afterCancel.consumedQuantity === 0,
    `consumed=${afterCancel.consumedQuantity} expected=0`
  );

  const cancel2 = await api('PUT', `/orders/${orderId}/cancel`, asCustomer);
  check(
    'cancelling twice -> 400',
    cancel2.status === 400,
    `status=${cancel2.status} message=${cancel2.json?.message || ''}`
  );

  const afterDoubleCancel = await getRx(rx.id);
  check(
    'units were refunded exactly once, not twice',
    afterDoubleCancel.consumedQuantity === 0,
    `consumed=${afterDoubleCancel.consumedQuantity} (a second refund would drive this negative, clamped to 0)`
  );

  const reorder = await api('POST', '/orders', asCustomer);
  check(
    'the same quantity can be ordered again after cancelling',
    reorder.status === 200,
    `status=${reorder.status} message=${reorder.json?.message || ''}`
  );

  // -- No prescription at all ------------------------------------------------
  console.log('\nNo prescription at all');

  await fx.setCart([{ id: medTwo.id, quantity: 1 }]);
  await prisma.prescription.deleteMany({ where: { userId: fx.user.id } });

  const noRx = await api('POST', '/orders', asCustomer);
  const msgNo = noRx.json?.message || '';
  check(
    'POST /orders with no prescription -> 409, message unchanged',
    noRx.status === 409 &&
      /requires an approved prescription/i.test(msgNo) &&
      msgNo.includes(medTwo.name),
    `status=${noRx.status} message="${msgNo.slice(0, 90)}"`
  );
  check(
    'that rejection reports prescriptionRequired (not exhausted)',
    noRx.json?.prescriptionRequired === true &&
      noRx.json?.prescriptionExhausted === undefined,
    `prescriptionRequired=${noRx.json?.prescriptionRequired} prescriptionExhausted=${noRx.json?.prescriptionExhausted}`
  );

  // -- Two restricted medicines consume both budgets -------------------------
  console.log('\nTwo restricted medicines in one order');

  await prisma.prescription.deleteMany({ where: { userId: fx.user.id } });
  const rxA = await fx.approvedFor(medOne);
  const rxB = await fx.approvedFor(medTwo);
  await fx.setCart([
    { id: medOne.id, quantity: 2 },
    { id: medTwo.id, quantity: 2 },
  ]);

  const both = await api('POST', '/orders', asCustomer);
  check(
    'POST /orders succeeds with two restricted medicines',
    both.status === 200,
    `status=${both.status} message=${both.json?.message || ''}`
  );

  const consumedA = (await getRx(rxA.id)).consumedQuantity;
  const consumedB = (await getRx(rxB.id)).consumedQuantity;
  check(
    'BOTH prescriptions were consumed, not just the last one',
    consumedA === 2 && consumedB === 2,
    `${medOne.name}=${consumedA}, ${medTwo.name}=${consumedB}, expected 2 and 2`
  );
}

/* -------------------------------------------------------------------------- */

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--cleanup-only')) {
    await cleanup();
    return;
  }

  if (!args.includes('--yes')) {
    console.log(`
This writes to the database behind ${API} and then removes everything it
created (one throwaway customer, its cart, prescriptions and orders).

    node prisma/verify-phase7b.js --yes

Run it AFTER deploying the Phase 7b code.`);
    process.exit(1);
  }

  console.log(`Verifying Phase 7b against ${API}`);
  console.log(`Signing in as ${ADMIN_EMAIL}`);

  let fx = null;
  try {
    const login = await api('POST', '/auth/login', {
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    if (login.status !== 200) {
      console.error(
        `\nLogin failed for ${ADMIN_EMAIL} (${login.status}).\n` +
          'Set ADMIN_EMAIL and ADMIN_PASSWORD, or correct the seeded credentials.'
      );
      process.exit(1);
    }

    const fx = await buildFixture();
    await run({ ...fx, adminToken: login.json.data.accessToken });
  } catch (error) {
    console.error(`\nVerification crashed: ${error.message}`);
    failed += 1;
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  console.log(`\n${'='.repeat(52)}`);
  if (results.length === 0) {
    console.log('No checks ran -- treat the deploy as UNVERIFIED.');
  } else {
    const passed = results.length - failed;
    console.log(`${passed}/${results.length} checks passed`);
    if (failed > 0) {
      console.log(`${failed} FAILED -- do not consider the deploy verified.`);
    }
  }
  console.log('\nStill manual (needs a browser):');
  console.log('  - The React checkout warning banner for restricted medicines.');
  console.log('  - The pharmacist review screen shows the limit field.');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});