# PharmaZen 💊

A secure, role-based online pharmacy management system built for the Bangladeshi market. PharmaZen handles the full lifecycle of pharmaceutical e-commerce — from medicine browsing and prescription upload to bKash payment processing and admin order management.

> **Status:** 🚧 In active development

---

## Tech Stack

**Frontend**
- React + CSS Modules
- Axios (with httpOnly cookie support)
- React Router v6

**Backend**
- Node.js + Express.js
- PostgreSQL (hosted on Neon)
- Prisma ORM

**Services**
- Cloudinary — prescription file storage
- bKash — payment gateway (sandbox)
- Vercel — deployment

---

## Features

### User
- Register and login with JWT authentication (access + refresh token rotation)
- Browse 21,000+ real Bangladeshi medicines with prices in BDT
- Add medicines to cart and place orders
- Upload prescriptions (PDF/image) for controlled medicines
- Track prescription approval status and order history
- Pay via bKash with full server-side payment verification

### Admin
- Protected dashboard — completely invisible to non-admin users
- Approve or reject uploaded prescriptions with review notes
- Manage medicines (create, update, delete)
- Manage orders and update order statuses
- View sales overview and revenue summary
- Low stock alerts
- User management and role control

---

## Project Structure

```
pharmazen/
├── pharmazen-backend/
│   ├── api/                  # Vercel serverless entry point
│   ├── src/
│   │   ├── config/           # DB and Cloudinary config
│   │   ├── middleware/       # JWT, role, validation, error handler
│   │   ├── modules/          # Auth, medicines, cart, orders, payments, admin
│   │   ├── utils/            # JWT helpers, response formatter
│   │   └── validators/       # Zod schemas
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js           # Seeds DB with real BD medicine data
│   ├── mock-bkash/           # Local bKash payment simulator
│   └── vercel.json
│
└── pharmazen-frontend/
    ├── src/
    │   ├── api/              # Axios instance
    │   ├── components/       # Shared, admin, and user components
    │   ├── context/          # Auth context
    │   ├── pages/            # User and admin pages
    │   └── routes/           # ProtectedRoute and AdminRoute guards
    └── .env
```

---

## Database

PostgreSQL schema with 10 tables:

| Table | Description |
|---|---|
| `users` | Authenticated users with roles (admin/user) |
| `refresh_tokens` | Hashed refresh tokens with revocation tracking |
| `categories` | Medicine categories sourced from drug classifications |
| `medicines` | 21,700+ BD medicines with prices, stock, prescription flags |
| `prescriptions` | Uploaded prescription files with approval workflow |
| `carts` | One cart per user |
| `cart_items` | Items in a cart with quantity |
| `orders` | Orders with status and payment tracking |
| `order_items` | Snapshot of medicines and prices at time of purchase |
| `payments` | bKash transaction records |

Medicine data is sourced from a real Bangladeshi medicine dataset containing brand names, generic names, manufacturers, dosage forms, and unit prices in BDT.

---

## Authentication Flow

- JWT access tokens (15 min) + refresh tokens (7 days) stored in httpOnly cookies
- Refresh token rotation on every use — old tokens are immediately revoked
- Breach detection — if a revoked token is reused, all sessions for that user are terminated
- Role-based middleware protects all sensitive routes at the API level

---

## Payment Flow (bKash)

All payment logic runs exclusively on the backend:

1. Backend requests a token from bKash
2. Backend creates a payment session and returns the bKash URL
3. User completes payment on the bKash-hosted page
4. bKash calls the backend callback URL
5. Backend executes and independently queries the payment for verification
6. Amount is validated against the order total in the database
7. Only then is the order atomically marked as paid

> During development, a local mock bKash server simulates this entire flow without real credentials.

---

## Getting Started

### Prerequisites
- Node.js v18+
- A [Neon](https://neon.tech) PostgreSQL database
- A [Cloudinary](https://cloudinary.com) account
- A [Vercel](https://vercel.com) account

### Backend

```bash
cd pharmazen-backend
npm install
cp .env.example .env
# Fill in your environment variables
npx prisma generate
npx prisma db push
node prisma/seed.js   # Seeds the database with medicine data
npm run dev
```

### Frontend

```bash
cd pharmazen-frontend
npm install
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:5000/api
npm run dev
```

### Running with mock bKash

The mock bKash server runs automatically alongside the backend:

```bash
cd pharmazen-backend
npm run dev   # starts backend + mock bKash server concurrently
```

---

## Environment Variables

### Backend `.env`

```
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
BKASH_APP_KEY=
BKASH_APP_SECRET=
BKASH_USERNAME=
BKASH_PASSWORD=
BKASH_BASE_URL=http://localhost:5001
BKASH_CALLBACK_URL=http://localhost:5000/api/payments/bkash/callback
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### Frontend `.env`

```
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## Deployment

Both frontend and backend are deployed on Vercel from this monorepo.

- **Backend** → Vercel root directory: `pharmazen-backend`
- **Frontend** → Vercel root directory: `pharmazen-frontend`
- **Database** → Neon (serverless PostgreSQL with connection pooling)
- **Files** → Cloudinary

---

## Security Highlights

- Passwords hashed with bcrypt (12 salt rounds)
- Tokens stored in httpOnly, Secure, SameSite=Strict cookies
- Refresh token breach detection with full session revocation
- Rate limiting on all auth routes
- Helmet.js security headers
- Input validation on every route with Zod
- CORS locked to frontend domain only
- Payment amount re-validated server-side before any order is marked paid
- Admin routes protected at both React router level and API middleware level

---