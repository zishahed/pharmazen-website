# PharmaZen Backend Architecture

## Directory Structure

```
pharmazen-backend/
├── .env                          # Environment config (DB, JWT, Cloudinary, bKash)
├── package.json                  # Node.js manifest, scripts, dependencies
├── api/
│   └── index.js                  # Server entry point (starts Express on port 5000)
├── prisma/
│   ├── schema.prisma             # DB schema: User, Medicine, Cart, Order, Payment, Prescription models
│   ├── seed.js                   # Migrates medicines from SQLite to PostgreSQL
│   └── seed-admins.js            # Creates admin/pharmacist seed accounts
└── src/
    ├── app.js                    # Express setup: CORS, cookies, mounts all routes
    ├── middleware/
    │   └── auth.js               # authenticate, authorize(roles), optionalAuth middleware
    ├── utils/
    │   └── jwt.js                # generate/verify access+refresh tokens, hashToken
    ├── services/
    │   └── bkash/
    │       └── bkash.service.js  # bKash payment gateway (mock mode for dev)
    └── modules/
        ├── auth/                 # Register, login, logout, refresh, staff creation
        │   ├── auth.routes.js
        │   ├── auth.controller.js
        │   └── auth.service.js
        ├── medicines/            # CRUD + search, filter (generic/company/price), pagination
        │   ├── medicines.routes.js
        │   ├── medicines.controller.js
        │   └── medicines.service.js
        ├── categories/           # List all categories (sorted by name)
        │   ├── categories.routes.js
        │   └── categories.controller.js
        ├── cart/                 # Add/update/remove/clear cart items (max qty 5)
        │   ├── cart.routes.js
        │   ├── cart.controller.js
        │   └── cart.service.js
        ├── orders/               # Create from cart, list, cancel (validates prescriptions)
        │   ├── orders.routes.js
        │   ├── orders.controller.js
        │   └── orders.service.js
        ├── payments/             # bKash payment create/execute/query/callback
        │   ├── payments.routes.js
        │   ├── payments.controller.js
        │   └── payments.service.js
        ├── prescriptions/        # Upload (Cloudinary), review (pharmacist approve/reject)
        │   ├── prescriptions.routes.js
        │   ├── prescriptions.controller.js
        │   └── prescriptions.service.js
        └── admin/                # Dashboard: stats, orders, users, sales analytics
            ├── admin.routes.js
            └── admin.controller.js
```

---

## 1. Root-Level Configuration

### `package.json`

- **Purpose:** Project manifest
- **Scripts:**
  - `"dev"`: Runs `nodemon api/index.js` — auto-restarts on file changes
  - `"seed"`: Runs `prisma/seed.js` with dotenv — migrates medicine data from SQLite (`medicines.db`) to PostgreSQL
  - `"seed:admins"`: Runs `prisma/seed-admins.js` — creates default admin/pharmacist accounts
- **Key Dependencies:**
  - `express` — HTTP framework
  - `@prisma/client` + `prisma` — ORM for PostgreSQL
  - `@neondatabase/serverless` + `@prisma/adapter-neon` — Neon serverless PostgreSQL adapter
  - `bcryptjs` — password hashing
  - `jsonwebtoken` — JWT creation/verification
  - `cloudinary` + `multer` + `streamifier` — file uploads (multer memory storage → stream to Cloudinary)
  - `cors`, `helmet`, `express-rate-limit` — security
  - `cookie-parser` — parse httpOnly cookies
  - `zod` — schema validation
  - `axios` — HTTP client (for bKash API)
  - `better-sqlite3` — reads local SQLite `medicines.db` during seeding
  - `ws` — WebSocket library
  - `dotenv` (dev) — env loading
  - `nodemon` (dev) — auto-restart

### `.env`

32 environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string to Neon |
| `JWT_ACCESS_SECRET` | 64-byte hex secret for access tokens |
| `JWT_REFRESH_SECRET` | 64-byte hex secret for refresh tokens |
| `ACCESS_TOKEN_EXPIRY` | `15m` |
| `REFRESH_TOKEN_EXPIRY` | `7d` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `BKASH_APP_KEY` | bKash app key (placeholder) |
| `BKASH_APP_SECRET` | bKash app secret (placeholder) |
| `BKASH_USERNAME` | bKash username (placeholder) |
| `BKASH_PASSWORD` | bKash password (placeholder) |
| `BKASH_BASE_URL` | bKash sandbox URL |
| `BKASH_CALLBACK_URL` | Callback URL for bKash redirect |
| `BKASH_MOCK` | `true` (mock mode enabled) |
| `FRONTEND_URL` | `http://localhost:5173` |
| `NODE_ENV` | `development` |

---

## 2. Entry Point

### `api/index.js` (7 lines)

```js
require('dotenv').config();
const app = require('../src/app');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

- Loads `dotenv` config
- Imports `app` from `src/app.js`
- Starts Express server on `PORT` (default 5000)

---

## 3. Database Layer — `prisma/`

### `prisma/schema.prisma` (203 lines)

**Datasource:** PostgreSQL via `DATABASE_URL` env var

**Enums (5):**

| Enum | Values |
|---|---|
| `Role` | `customer`, `pharmacist`, `admin` |
| `PrescriptionStatus` | `pending`, `approved`, `rejected` |
| `OrderStatus` | `pending`, `awaiting_prescription`, `paid`, `cancelled` |
| `PaymentStatus` | `unpaid`, `paid`, `failed` |
| `PaymentRecordStatus` | `initiated`, `completed`, `failed` |

**Models (10):**

| Model | Fields | Key Relations |
|---|---|---|
| **User** | id (UUID), name, email (unique), passwordHash, role (default: customer), timestamps | → RefreshToken[], Prescription[], Order[], Cart?, reviewedPrescriptions[] |
| **RefreshToken** | id, userId, tokenHash, isRevoked (default false), expiresAt | → User (Cascade) |
| **Category** | id, name (unique) | → Medicine[] |
| **Medicine** | id, name, description?, categoryId, price (Decimal 10,2), stockQuantity, expiryDate?, requiresPrescription (default false) | → Category, CartItem[], OrderItem[] |
| **Prescription** | id, userId, medicineId, medicineName, startDate, endDate, comment?, status (default: pending), reviewedBy?, reviewNote? | → User (Cascade), reviewer (User), Order[], PrescriptionFile[] |
| **PrescriptionFile** | id, prescriptionId, fileUrl, cloudinaryId | → Prescription (Cascade) |
| **Cart** | id, userId (unique) | → User (Cascade), CartItem[] |
| **CartItem** | id, cartId, medicineId, quantity | → Cart (Cascade), Medicine |
| **Order** | id, userId, totalAmount (Decimal), status (default: pending), paymentStatus (default: unpaid), prescriptionId? | → User, Prescription?, OrderItem[], Payment? |
| **OrderItem** | id, orderId, medicineId, quantity, priceAtPurchase | → Order (Cascade), Medicine |
| **Payment** | id, orderId (unique), bkashPaymentId (unique), transactionId (unique), amount, status (default: initiated) | → Order |

- All IDs are UUIDs generated by PostgreSQL (`gen_random_uuid()`)
- Table names mapped to snake_case via `@@map()`

### `prisma/seed.js` (98 lines)

- Opens `medicines.db` (SQLite, read-only)
- **Step 1 — Categories:** Reads `generics` table → extracts unique `drug_class` values → inserts as categories → builds `generic_id → category_id` map
- **Step 2 — Medicines:** Reads `medicines` table (includes `brand_name`, `generic_name`, `dosage_form`, `strength`, `manufacturer`, `package_container`, `isSensitive`)
  - `parsePrice()`: extracts BDT amount from `"৳ 150.00"` format via regex
  - Constructs `description` as `"GenericName | DosageForm | Strength | Manufacturer"`
  - Default `stockQuantity: 100`, `expiryDate: null`
  - `requiresPrescription: m.isSensitive === 1`
  - Inserts in batches of 500 using `createMany` with `skipDuplicates`

### `prisma/seed-admins.js` (62 lines)

Creates 2 accounts via `prisma.user.upsert` (safe to re-run):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@pharmazen.com` | `admin123` |
| Pharmacist | `pharmacist@pharmazen.com` | `pharmacist123` |

Passwords hashed with `bcryptjs` (12 salt rounds).

---

## 4. Express App Setup — `src/app.js` (39 lines)

**Middleware stack (in order):**

1. `cors({ origin: 'http://localhost:5173', credentials: true })` — allows Vite dev server with cookies
2. `express.json()` — parses JSON bodies
3. `cookie-parser()` — parses cookies into `req.cookies`

**Route mounting (8 route groups):**

| Prefix | Module | File |
|---|---|---|
| `/` | Health check | inline — `{ success: true, message: 'PharmaZen API is running' }` |
| `/api/auth` | Auth | `modules/auth/auth.routes.js` |
| `/api/medicines` | Medicines | `modules/medicines/medicines.routes.js` |
| `/api/categories` | Categories | `modules/categories/categories.routes.js` |
| `/api/cart` | Cart | `modules/cart/cart.routes.js` |
| `/api/orders` | Orders | `modules/orders/orders.routes.js` |
| `/api/payments` | Payments | `modules/payments/payments.routes.js` |
| `/api/prescriptions` | Prescriptions | `modules/prescriptions/prescriptions.routes.js` |
| `/api/admin` | Admin | `modules/admin/admin.routes.js` |

---

## 5. Middleware — `src/middleware/auth.js` (89 lines)

### `authenticate`

- Extracts token from `req.cookies.accessToken` (priority) OR `Authorization: Bearer <token>` header
- No token → 401 `"Authentication required"`
- Calls `verifyAccessToken(token)`
- Success: attaches `req.user = { id, email, role }` and calls `next()`
- Error → 401 `"Invalid or expired token"`

### `authorize(...roles)`

- Factory returning middleware that checks `req.user.role` against allowed roles
- No `req.user` → 401
- Role not in list → 403 `"Access denied. Insufficient permissions."`

### `optionalAuth`

- Same token extraction as `authenticate`
- If valid token: sets `req.user`
- If missing/invalid: silently continues

---

## 6. Utilities — `src/utils/jwt.js` (67 lines)

| Function | Signature | What it does |
|---|---|---|
| `generateAccessToken(payload)` | `({id,email,role}) → string` | Signs JWT with `JWT_ACCESS_SECRET`, expiry from `ACCESS_TOKEN_EXPIRY` (default 15m) |
| `generateRefreshToken(payload)` | `({id,email,role}) → string` | Signs JWT with `JWT_REFRESH_SECRET`, expiry from `REFRESH_TOKEN_EXPIRY` (default 7d) |
| `verifyAccessToken(token)` | `(string) → decoded payload` | Verifies + decodes using secret. Throws on invalid |
| `verifyRefreshToken(token)` | `(string) → decoded payload` | Same for refresh secret |
| `hashToken(token)` | `(string) → string` | SHA-256 hash via `crypto.createHash('sha256')` |

---

## 7. bKash Payment Service — `src/services/bkash/bkash.service.js` (241 lines)

### Mock Detection

`IS_MOCK = true` when `BKASH_MOCK=true` OR `BKASH_APP_KEY` is placeholder `'your_bkash_app_key'`

### Mock Functions (all add artificial delays via `sleep(ms)`)

| Function | Behavior |
|---|---|
| `mockGrantToken()` | 200ms delay, returns random 64-char hex `id_token` prefixed `mock_` |
| `mockCreatePayment(amount, invoice)` | 300ms, returns mock payment with `payment_id` (`mock_payment_<hex>`), `gatewayPageURL`, status `"Created"` |
| `mockExecutePayment(paymentId)` | 500ms, validates mock ID format, returns mock `trx_id` (`TXN<timestamp><hex>`), status `"Completed"` |
| `mockQueryPayment(paymentId)` | 200ms, returns completed state |
| `mockCallback(paymentId)` | 200ms, returns success |

### Real Functions (HTTP to bKash sandbox API)

| Function | API Endpoint |
|---|---|
| `realGrantToken()` | `POST /tokenized/checkout/token/grant` |
| `realCreatePayment(token, amount, invoice)` | `POST /tokenized/checkout/create` |
| `realExecutePayment(token, paymentId)` | `POST /tokenized/checkout/execute` |
| `realQueryPayment(token, paymentId)` | `POST /tokenized/checkout/payment/status` |

### Token Caching

- `getAccessToken()` checks if `cachedToken` is still valid (within 60s buffer of expiry)
- If expired or missing: calls `grantToken()`, stores with expiry

### Exports

`grantToken`, `createPayment`, `executePayment`, `queryPayment`, `handleCallback`, `getAccessToken`, `IS_MOCK`

---

## 8. Auth Module — `modules/auth/`

### `auth.routes.js` (20 lines)

| Method | Path | Auth | Handler |
|---|---|---|---|
| POST | `/register` | Public | `register` |
| POST | `/login` | Public | `login` |
| POST | `/refresh` | Public | `refresh` |
| GET | `/check` | Public | `checkAuth` |
| POST | `/logout` | `authenticate` | `logout` |
| GET | `/me` | `authenticate` | `getCurrentUser` |
| POST | `/admin/register-staff` | `authenticate` + `authorize('admin')` | `registerStaff` |

### `auth.controller.js` (303 lines) — 7 Handlers

| Handler | Input Validation | Logic |
|---|---|---|
| `register` | name, email (regex), password (min 8 chars, alphanumeric regex) | Calls `authService.register()`, returns 201 |
| `login` | email, password required | Calls `authService.login()`, sets `accessToken` (15min) + `refreshToken` (7d) httpOnly cookies + also returns accessToken in body for mobile apps |
| `refresh` | refreshToken from cookie or body | Calls `authService.refreshAccessToken()`, sets new cookie pair |
| `logout` | refreshToken from cookie | Calls `authService.logout()`, clears both cookies |
| `getCurrentUser` | (from `req.user` middleware) | Calls `authService.getUserById(req.user.id)` |
| `checkAuth` | token from cookie or header | Calls `verifyAccessToken` locally (no DB call), returns `{ authenticated: boolean }` |
| `registerStaff` | name, email, password, role (must be pharmacist/admin) | Same validations as register + role must be `'pharmacist'` or `'admin'`. Calls `authService.registerStaff()` |

### `auth.service.js` (281 lines) — 7 Business Logic Functions

| Function | What it does |
|---|---|
| `register({name,email,password,role})` | Checks duplicate email → hashes password (bcrypt, 12 rounds) → creates user → if role=customer, creates a Cart → returns user (without passwordHash) |
| `login({email,password})` | Finds user by email → bcrypt.compare password → generates access+refresh JWT → hashes refresh token → stores in `refresh_tokens` table with 7d expiry → returns user + both tokens |
| `refreshAccessToken(refreshToken)` | Hashes incoming token → finds non-revoked, non-expired `RefreshToken` record → generates new token pair → revokes old token (rotation) → stores new token → returns new tokens + user |
| `logout(refreshToken)` | Hashes token → sets `isRevoked: true` |
| `revokeAllUserTokens(userId)` | Revokes ALL refresh tokens for a user (security breach recovery) |
| `registerStaff({name,email,password,role})` | Similar to register but skips Cart creation, only allows `pharmacist`/`admin` roles |
| `getUserById(userId)` | Finds user by UUID, excludes `passwordHash` |

**Security pattern:** Refresh token rotation — every refresh invalidates the old token, preventing token reuse if stolen.

---

## 9. Medicines Module — `modules/medicines/`

### `medicines.routes.js` (35 lines)

**Public routes (no auth):**

| Method | Path | Description |
|---|---|---|
| GET | `/` | List/search medicines with filters + pagination |
| GET | `/max-price` | Get max price for price slider |
| GET | `/filters` | Get unique generic names + companies |
| GET | `/restricted` | Get prescription-required medicines |

**Admin routes (`authenticate` + `authorize('admin')`):**

| Method | Path | Description |
|---|---|---|
| GET | `/:id` | Get single medicine by ID |
| POST | `/` | Create medicine |
| PUT | `/:id` | Update medicine |
| DELETE | `/:id` | Delete medicine |
| PATCH | `/:id/stock` | Update stock quantity |

### `medicines.controller.js` (163 lines) — 9 Handlers

- `getMedicines`, `getMaxPrice`, `getFilterOptions`, `getRestrictedMedicines`, `getMedicineById`, `createMedicine`, `updateMedicine`, `deleteMedicine`, `updateStock`
- Each extracts query params/body/params, calls the service, returns JSON
- Consistent error handling: try/catch → 500

### `medicines.service.js` (280 lines) — 9 Functions

| Function | Logic |
|---|---|
| `getMedicines(params)` | Builds Prisma `where`: search by name (`contains`, case-insensitive), genericName + company parsed from `description` field (`"GenericName \| Dosage \| Strength \| Manufacturer"`), categoryId exact match, price range (`gte`/`lte`), prescription boolean. Sort: if filters applied → `name: 'asc'`, else → `createdAt: 'desc'`. Pagination with `skip`/`take` (default 20). Parallel `findMany` + `count`. Returns `{ medicines, total, page, totalPages }` |
| `getMaxPrice()` | `prisma.medicine.aggregate({ _max: { price } })`. Returns max or default 10000 |
| `getFilterOptions()` | Fetch all descriptions → split by `\|` → `parts[0]` = generic name, `parts[3]` = manufacturer → deduped sorted arrays |
| `getRestrictedMedicines(search)` | `where: { requiresPrescription: true }` + optional name search. Limit 50 |
| `getMedicineById(id)` | `findUnique` with category include |
| `createMedicine(data)` | Creates with parsed float/int, optional expiry date |
| `updateMedicine(id, data)` | Dynamic update — only includes defined fields |
| `deleteMedicine(id)` | `prisma.medicine.delete` |
| `updateStock(id, quantity)` | Updates `stockQuantity` |

---

## 10. Categories Module — `modules/categories/`

### `categories.routes.js` (8 lines)

| Method | Path | Handler |
|---|---|---|
| GET | `/` | `getCategories` |

### `categories.controller.js` (27 lines)

- `getCategories`: `prisma.category.findMany({ orderBy: { name: 'asc' } })` — simplest handler, no service layer

---

## 11. Cart Module — `modules/cart/`

### `cart.routes.js` (12 lines)

All require `authenticate`:

| Method | Path | Handler |
|---|---|---|
| GET | `/` | `getCart` |
| POST | `/` | `addToCart` |
| PUT | `/` | `updateCartItem` |
| DELETE | `/` | `clearCart` |
| DELETE | `/:medicineId` | `removeFromCart` |

### `cart.controller.js` (130 lines) — 5 Handlers

- All extract `userId` from `req.user.id`
- Input validation: checks `medicineId` for add/update/remove, `quantity` for update
- All return updated cart object

### `cart.service.js` (164 lines) — 5 Functions

**Constant:** `MAX_QUANTITY = 5`

| Function | Logic |
|---|---|
| `getCart(userId)` | Find cart → include items with medicine details (id, name, price, stock, prescription flag, category name). Returns `{ items: [...] }`. No cart → `{ items: [] }` |
| `addToCart(userId, medicineId, quantity)` | Find or create cart → check existing `CartItem` via `(cartId, medicineId)` compound unique → if exists, increment (capped at 5) → if new, create (capped at 5). Throws if over limit |
| `updateCartItemQuantity(userId, medicineId, quantity)` | `quantity <= 0`: delete item. `> MAX_QUANTITY`: throw. Else: `updateMany` |
| `removeFromCart(userId, medicineId)` | `deleteMany` by cartId + medicineId |
| `clearCart(userId)` | `deleteMany` all items in cart |

---

## 12. Orders Module — `modules/orders/`

### `orders.routes.js` (11 lines)

All require `authenticate`:

| Method | Path | Handler |
|---|---|---|
| POST | `/` | `createOrder` |
| GET | `/` | `getUserOrders` |
| GET | `/:orderId` | `getOrderById` |
| PUT | `/:orderId/cancel` | `cancelOrder` |

### `orders.controller.js` (86 lines) — 4 Handlers

- Standard pattern: extract `userId`, `orderId`, call service, return JSON

### `orders.service.js` (230 lines) — 4 Functions

| Function | Logic |
|---|---|
| `createOrderFromCart(userId)` | Fetch cart with items + medicines. Validate: not empty, quantity ≤ 5. Check if any item `requiresPrescription` → find user's latest **approved** prescription. If none → set status to `awaiting_prescription`. Calculate `totalAmount`. Create Order + OrderItems in nested `create`. Does NOT clear cart. Returns order with items + prescription info |
| `getOrders(userId)` | `findMany` with items + medicine name + payment. Sorted by `createdAt: 'desc'` |
| `getOrderById(userId, orderId)` | `findUnique` where `{ id, userId }`. Includes items, payment, prescription with first file URL |
| `cancelOrder(userId, orderId)` | Find order. Validate: must exist, payment NOT `'paid'`, status NOT `'cancelled'`. Then update to `'cancelled'` |

---

## 13. Payments Module — `modules/payments/`

### `payments.routes.js` (12 lines)

| Method | Path | Auth | Handler |
|---|---|---|---|
| POST | `/create` | `authenticate` | `createPayment` |
| POST | `/execute` | `authenticate` | `executePayment` |
| GET | `/query/:paymentId` | `authenticate` | `queryPayment` |
| GET | `/status/:orderId` | `authenticate` | `getPaymentStatus` |
| GET | `/bkash/callback` | Public | `bkashCallback` |

### `payments.controller.js` (160 lines) — 5 Handlers

| Handler | Input | Logic |
|---|---|---|
| `createPayment` | `{ orderId, amount }` | Calls `createPaymentSession` → returns `{ bkashUrl, paymentId, merchantInvoiceNumber, amount, isMock }` |
| `executePayment` | `{ paymentId }` | Calls `executePayment` → returns success/fail with transactionId |
| `queryPayment` | `paymentId` (params) | Calls `queryPayment` → returns bKash status |
| `bkashCallback` | `paymentId` (query) | Called by bKash redirect. Calls `handleCallback` → redirects user to `FRONTEND_URL/payment/success?orderId=...&trxId=...` or `/payment/failed` |
| `getPaymentStatus` | `orderId` (params) | Fetches payment + order, returns combined status |

### `payments.service.js` (164 lines) — 5 Functions

| Function | Logic |
|---|---|
| `createPaymentSession(userId, orderId, amount)` | Validate order exists, belongs to user, not paid. Generate merchant invoice (`PHZ` + truncated orderId + timestamp). Call `bkashService.createPayment()`. Create Payment record (`status: 'initiated'`). Return bKash URL + paymentId |
| `executePayment(userId, paymentId)` | Find Payment by `bkashPaymentId`. Validate ownership. If already completed → early return. Call `bkashService.executePayment()`. On success: update Payment to `completed`, Order to `status: 'paid'` + `paymentStatus: 'paid'`, decrement stock per medicine |
| `queryPayment(paymentId)` | Find Payment, call bKash query, return status |
| `handleCallback(paymentId)` | Calls `executePayment` |
| `getPaymentByOrderId(orderId)` | `findUnique` by orderId (1:1 relation) |

---

## 14. Prescriptions Module — `modules/prescriptions/`

### `prescriptions.routes.js` (35 lines)

**Multer config:** `memoryStorage`, max 10MB per file, only `image/*` and `application/pdf`.

**All routes require `authenticate`:**

| Method | Path | Auth (additional) | Handler |
|---|---|---|---|
| POST | `/` | — | `uploadPrescription` (multer max 4 files) |
| GET | `/` | — | `getUserPrescriptions` |
| GET | `/pending` | `authorize('pharmacist', 'admin')` | `getPendingPrescriptions` |
| GET | `/:id` | `authorize('pharmacist', 'admin')` | `getPrescriptionById` |
| PUT | `/:id/review` | `authorize('pharmacist', 'admin')` | `reviewPrescription` |

### `prescriptions.controller.js` (203 lines) — 5 Handlers

- Configures Cloudinary v2 at module level with env credentials

| Handler | Logic |
|---|---|
| `uploadPrescription` | Validate: files exist (≥1), medicineId, startDate, endDate, max 4 files. Upload all files **in parallel** via `Promise.all` → each file streamed from buffer via `streamifier` to `cloudinary.uploader.upload_stream` (folder: `pharmazen/prescriptions`). Then call `createPrescription` with Cloudinary results |
| `getUserPrescriptions` | Call service → return user's history |
| `getPendingPrescriptions` | Call service (pharmacist review queue) |
| `getPrescriptionById` | Call service, 404 if null |
| `reviewPrescription` | Validate status is `'approved'` or `'rejected'`. Check prescription still pending. Call `reviewPrescription` |

### `prescriptions.service.js` (198 lines) — 5 Functions

| Function | Logic |
|---|---|
| `createPrescription(data)` | Create Prescription with nested `PrescriptionFile[]`. Status `pending`. Return with file includes |
| `getUserPrescriptions(userId)` | `findMany` sorted by `createdAt: 'desc'`. Include reviewer name + file URLs |
| `getPendingPrescriptions()` | `where: { status: 'pending' }`. Include user info (name, email) + file URLs |
| `getPrescriptionById(id)` | `findUnique` with user info + files. Return null if not found |
| `reviewPrescription(id, reviewerId, status, reviewNote)` | Update status, `reviewedBy`, `reviewNote`. Return with user + files |

---

## 15. Admin Module — `modules/admin/`

### `admin.routes.js` (13 lines)

All require `authenticate` + `authorize('admin')`:

| Method | Path | Handler |
|---|---|---|
| GET | `/stats` | `getDashboardStats` |
| GET | `/orders` | `getAllOrders` |
| GET | `/users` | `getAllUsers` |
| GET | `/sales` | `getSalesAnalytics` |
| PATCH | `/orders/:id/status` | `updateOrderStatus` |
| PATCH | `/users/:id/role` | `updateUserRole` |

### `admin.controller.js` (297 lines) — 6 Handlers (inline logic, no service layer)

| Handler | Queries | Logic |
|---|---|---|
| `getDashboardStats` | **6 parallel queries:** `medicine.count()`, `order.count()`, `user.count()`, `prescription.count({ status: 'pending' })`, `medicine.count({ stockQuantity: { lte: 10 } })`, `payment.aggregate({ _sum: amount }, { status: 'completed' })` | Returns all 6 numbers |
| `getAllOrders` | Filter: `status`, `paymentStatus`, search by user name/email. `findMany` + `count` in parallel. Include user info, items with medicine name, payment transactionId | Formats into clean array |
| `getAllUsers` | Filter: `role`, search by name/email. Include `_count.orders` | Formats with orderCount |
| `getSalesAnalytics` | Fetch ALL paid orders with items + medicine (description, category). In-memory aggregation: loop every order/item, parse `description` for generic name (`parts[0]`) and company (`parts[3]`), accumulate revenue by medicine/generic/company/category. Return `summary` (totalRevenue, totalOrders, totalItemsSold, avgOrderValue) + 4 sorted arrays (desc by revenue) |
| `updateOrderStatus` | Validate status ∈ `['pending', 'awaiting_prescription', 'paid', 'cancelled']`. Update order, return full detail |
| `updateUserRole` | Validate role ∈ `['customer', 'pharmacist', 'admin']`. **Prevents self-role-change**. Update, return user with orderCount |

---

## Known Issues / Bugs

1. **`payments.controller.js:121-123`** — Unnecessary PrismaClient creation. Should reuse the service's PrismaClient.

2. **`payments.service.js:91-102`** — Useless `updateMany` with `decrement: 0` before actual per-item stock decrement loop.

3. **`payments.service.js:148-149`** — `handleCallback` calls `executePayment(null, paymentId)`. Inside `executePayment`, the ownership check `payment.order.userId !== userId` will throw `"Unauthorized"` since `userId` is `null`. **Callback flow is broken for non-mock mode.**

4. **`orders.service.js`** — `createOrderFromCart` does NOT clear the cart after order creation.

5. **`admin.controller.js:222`** — Sales analytics fetches ALL paid orders without date range or pagination — will be slow with large datasets.

6. **`medicines.service.js:10-11`** — `page` and `limit` default to strings from query params; `parseInt` used inconsistently.

---

## Technology Stack Summary

| Layer | Technology |
|---|---|
| **Runtime** | Node.js |
| **Framework** | Express 5 |
| **Database** | PostgreSQL (Neon serverless) |
| **ORM** | Prisma ORM |
| **Auth** | JWT (access + refresh tokens with rotation) |
| **File Uploads** | Multer (memory storage) + Cloudinary |
| **Payment** | bKash Tokenized Checkout (with mock mode) |
| **Validation** | Zod (listed in deps) + manual validation in controllers |
| **Security** | bcryptjs, helmet, express-rate-limit, cors |
| **Real-time** | ws (WebSocket library listed) |
| **Dev** | nodemon, dotenv |

## Architecture Pattern

- **Routes** → **Controller** → **Service** layered separation
- Exceptions: Admin module (logic in controller), Categories module (trivial, no service)
- Each module is self-contained with routes, controller, and service files
- Shared utilities (JWT, auth middleware, bKash service) kept in separate directories
