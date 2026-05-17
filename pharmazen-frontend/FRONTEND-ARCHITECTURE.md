# PharmaZen Frontend Architecture

## Directory Structure

```
pharmazen-frontend/
├── .env                          # VITE_API_BASE_URL=http://localhost:5000/api
├── package.json                  # Node.js manifest, scripts, dependencies
├── vite.config.js                # Vite build configuration
├── eslint.config.js              # ESLint flat config
├── index.html                    # HTML entry point
├── README.md
├── public/
│   └── logo.png                  # App logo
├── dist/                         # Production build output
│   ├── index.html
│   └── assets/
│       ├── index-B51nXc9e.js
│       └── index-BwFn7qCr.css
└── src/
    ├── main.jsx                  # React entry point (mounts app)
    ├── index.css                 # Global CSS with design tokens
    ├── App.jsx                   # Root component with routing
    ├── api/
    │   ├── axiosClient.js        # Shared Axios instance with interceptors
    │   ├── authApi.js            # Auth endpoints
    │   ├── medicinesApi.js       # Medicine endpoints
    │   ├── orderApi.js           # Order endpoints
    │   ├── paymentApi.js         # Payment endpoints
    │   ├── presApi.js            # Prescription endpoints
    │   └── adminApi.js           # Admin endpoints
    ├── context/
    │   ├── AuthContext.jsx       # Auth state management provider
    │   └── CartContext.jsx       # Cart state management provider
    └── components/
        ├── AuthCartSync.jsx       # Coordinates cart sync on login/logout
        ├── auth/
        │   └── ProtectedRoute.jsx # Route guard by authentication and role
        ├── common/
        │   ├── Header.jsx         # Main navigation header
        │   ├── Header.module.css
        │   ├── Footer.jsx         # Site footer
        │   ├── Footer.module.css
        │   ├── Loader.jsx         # Animated loading spinner
        │   ├── Loader.module.css
        │   ├── SearchableSelect.jsx # Combobox with filtering
        │   └── SearchableSelect.module.css
        ├── user/
        │   ├── MedicineCard.jsx   # Product card
        │   ├── MedicineCard.module.css
        │   ├── FiltersSidebar.jsx # Sidebar with filters
        │   └── FiltersSidebar.module.css
        └── pages/
            ├── HomePage.jsx                    # Landing page
            ├── HomePage.module.css
            ├── ProductsPage.jsx                # Medicine listing
            ├── ProductsPage.module.css
            ├── LoginPage.jsx                   # Login form
            ├── LoginPage.module.css
            ├── RegisterPage.jsx                # Registration form
            ├── RegisterPage.module.css
            ├── StaffRegistrationPage.jsx       # Admin staff creation
            ├── StaffRegistrationPage.module.css
            ├── CartPage.jsx                    # Shopping cart
            ├── CartPage.module.css
            ├── CheckoutPage.jsx                # Checkout with bKash
            ├── CheckoutPage.module.css
            ├── PaymentStatusPage.jsx           # Payment success/failure
            ├── PaymentStatusPage.module.css
            ├── PrescriptionsPage.jsx           # Customer prescription list
            ├── PrescriptionsPage.module.css
            ├── PrescriptionUploadPage.jsx      # Upload prescription
            ├── PrescriptionUploadPage.module.css
            ├── PrescriptionReviewPage.jsx      # Pharmacist review
            ├── PrescriptionReviewPage.module.css
            ├── OrdersPage.jsx                  # Customer order history
            ├── OrdersPage.module.css
            ├── ProfilePage.jsx                 # User profile
            ├── ProfilePage.module.css
            ├── UnauthorizedPage.jsx            # 403 page
            ├── UnauthorizedPage.module.css
            └── admin/
                ├── AdminDashboard.jsx          # Full admin panel
                └── AdminDashboard.module.css
```

---

## 1. Root-Level Configuration

### `package.json`

- **Purpose:** Project manifest
- **Scripts:**
  - `"dev"`: Runs `vite` — starts Vite dev server (default port 5173)
  - `"build"`: Runs `vite build` — outputs to `dist/`
  - `"preview"`: Runs `vite preview` — serves built `dist/` locally
  - `"lint"`: Runs `eslint .` — lints all source files
- **Key Dependencies:**
  - `react` (^19.2.0) — UI framework
  - `react-dom` (^19.2.0) — DOM rendering
  - `react-router-dom` (^7.13.0) — Client-side routing
  - `axios` (^1.13.5) — HTTP client for API calls
- **Dev Dependencies:**
  - `vite` (^7.3.1) — Build tool and dev server
  - `@vitejs/plugin-react` (^5.1.1) — React Fast Refresh for Vite
  - `eslint` (^9.39.1) — Linter
  - `eslint-plugin-react-hooks` (^7.0.1) — React hooks lint rules
  - `eslint-plugin-react-refresh` (^0.4.24) — HMR-safe lint rules

### `.env`

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `http://localhost:5000/api` |

Single environment variable pointing to the backend API. Vite automatically exposes `VITE_*` prefixed variables via `import.meta.env.VITE_API_BASE_URL`.

### `vite.config.js`

- **Plugin:** `@vitejs/plugin-react` (Babel-based Fast Refresh)
- **Dev server:** Vite defaults (port 5173)
- **Build output:** `dist/`
- No proxy config, no path aliases, no special resolve configuration

### `eslint.config.js`

- Flat config format (ESLint 9+)
- Extends `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh` recommended rules
- Ignores `dist/` directory

---

## 2. Entry Point

### `index.html` (14 lines)

Standard Vite HTML entry:
- `<div id="root">` mount point
- `<script type="module" src="/src/main.jsx">` entry script
- Meta viewport tag for responsive design
- Page title: "PharmaZen"

### `src/main.jsx` (7 lines)

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- Wraps the app in `React.StrictMode` for development warnings
- Imports global CSS (`index.css`) — the design token system
- Mounts the root `App` component into `#root`

### `src/index.css` — Global Styles & Design Tokens

CSS Custom Properties (design tokens) defined on `:root`:

| Token Category | Examples |
|---|---|
| **Primary Colors** | `--primary-green: #7ed957`, `--primary-blue: #004aad`, `--white` |
| **Secondary Colors** | gray light/medium/dark/border |
| **Status Colors** | success (green), danger (red), warning (amber), info (blue) with matching backgrounds |
| **Gradients** | `--gradient-blue`, `--gradient-green`, `--gradient-card` |
| **Border Radii** | sm (8px), default (12px), lg (16px), xl (20px) |
| **Box Shadows** | sm, default, lg, hover |
| **Spacing** | xs through 2xl |
| **Font Weights** | normal, medium, semibold, bold |
| **Transition** | `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)` |

Also includes:
- Global reset (`* { margin:0; padding:0; box-sizing:border-box }`)
- Body styling: gradient background, system font stack, antialiased
- Typography defaults: h1/h2/h3/p/small
- Button defaults: rounded, semibold, hover lift + shadow
- Form element defaults: border, focus ring, hover effects
- Custom scrollbar styling (blue thumb)

---

## 3. App Wrapper & Routing — `src/App.jsx` (105 lines)

### Provider Hierarchy

```
<AuthProvider>
  <CartProvider>
    <AuthCartSync />
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/cart" element={<CartPage />} />
        ...
        {/* Protected routes wrapped in <ProtectedRoute> */}
      </Routes>
      <Footer />
    </BrowserRouter>
  </CartProvider>
</AuthProvider>
```

- `AuthProvider` — wraps everything, provides user authentication state
- `CartProvider` — provides shopping cart state
- `AuthCartSync` — registers login/logout callbacks to sync cart between localStorage and backend
- `Header` and `Footer` rendered outside Routes (persistent across all pages)
- `BrowserRouter` for client-side routing

### Route Table

| Path | Page Component | Auth | Roles |
|---|---|---|---|
| `/` | `HomePage` | Public | — |
| `/login` | `LoginPage` | Public | — |
| `/register` | `RegisterPage` | Public | — |
| `/unauthorized` | `UnauthorizedPage` | Public | — |
| `/products` | `ProductsPage` | Public | — |
| `/cart` | `CartPage` | Public | — |
| `/checkout` | `CheckoutPage` | Public | — |
| `/payment/success` | `PaymentStatusPage` | Public | — |
| `/payment/failed` | `PaymentStatusPage` | Public | — |
| `/prescriptions` | `PrescriptionsPage` | Protected | customer |
| `/upload-prescription` | `PrescriptionUploadPage` | Protected | customer |
| `/orders` | `OrdersPage` | Protected | customer |
| `/profile` | `ProfilePage` | Protected | customer, pharmacist, admin |
| `/admin` | `AdminDashboard` | Protected | admin |
| `/admin/register-staff` | `StaffRegistrationPage` | Protected | admin |
| `/review-prescriptions` | `PrescriptionReviewPage` | Protected | pharmacist, admin |

---

## 4. Auth Module — `src/context/AuthContext.jsx`

### State

| State | Type | Default | Description |
|---|---|---|---|
| `user` | object \| null | `null` | Current user `{ id, name, email, role, createdAt }` |
| `loading` | boolean | `true` | True during initial session restore |
| `error` | string | `""` | Error message from last operation |

### On Mount

Calls `GET /api/auth/me` (via `authApi.getCurrentUser()`) to restore session from HTTP-only cookie. Sets `loading = false` when complete.

### Exposed Methods & Helpers

| Method | Description |
|---|---|
| `login(email, password)` | Calls `POST /api/auth/login`, sets user, fires all registered login callbacks |
| `register(name, email, password)` | Calls `POST /api/auth/register`, then auto-login |
| `logout()` | Calls `POST /api/auth/logout`, clears user, fires all logout callbacks |
| `isAuthenticated()` | Returns `!!user` |
| `hasRole(roles)` | Returns `true` if user's role matches any in the array |
| `isGuest()` | Returns `!user` |
| `isCustomer()` | Returns `user?.role === 'customer'` |
| `isPharmacist()` | Returns `user?.role === 'pharmacist'` |
| `isAdmin()` | Returns `user?.role === 'admin'` |
| `onLogin(callback)` | Registers a login callback, returns `unsubscribe` function |
| `onLogout(callback)` | Registers a logout callback, returns `unsubscribe` function |

### Event System

- `onLogin` / `onLogout` allow external components (like `AuthCartSync`) to react to auth state changes
- Returns unsubscribe function for cleanup in `useEffect`
- Uses a simple array-based listener pattern

---

## 5. Cart Module — `src/context/CartContext.jsx`

### State

| State | Type | Default | Description |
|---|---|---|---|
| `cartItems` | array | `[]` | Items in cart with medicine details |
| `isLoading` | boolean | `true` | True during initial cart fetch |
| `isLoggedIn` | boolean | `false` | Tracks whether user is logged in |
| `pendingItem` | object \| null | `null` | Stashed item for guest-to-login flow |

### Persistence

- **Authenticated:** Cart stored on backend via Cart API
- **Guest:** Cart stored in `localStorage` under key `pharmazen_cart`
- On mount: if user is logged in, fetches from `GET /api/cart`; otherwise loads from localStorage

### Operations

| Method | Backend Call | Fallback |
|---|---|---|
| `addToCart(medicine, quantity=1)` | `POST /api/cart { medicineId, quantity }` | Local state + localStorage (max 5) |
| `removeFromCart(medicineId)` | `DELETE /api/cart/{medicineId}` | Local state |
| `updateQuantity(medicineId, quantity)` | `PUT /api/cart { medicineId, quantity }` | Local state |
| `clearCart()` | `DELETE /api/cart` | Local state + remove localStorage |
| `getCartTotal()` | — | Computed: sum of `price * quantity` |
| `getCartCount()` | — | Computed: sum of quantities |

### Cart Sync (Guest → Authenticated)

- `syncLocalCartToBackend()`: Called on login. Iterates localStorage items, calls `addToCart` for each. On success, clears localStorage.
- `onLoginSuccess`: Registered via `AuthContext.onLogin()`, triggers sync
- On logout: Clears cartItems, clears localStorage
- **Pending Item:** When a guest clicks "Add to Cart", the first item is stashed in `pendingItem`. After login, this item is added to the cart.

### Constants

- `MAX_QUANTITY = 5` — hard limit on any medicine quantity

### Implementation Detail

Uses raw `fetch()` API directly (not Axios) for all cart operations, with `withCredentials: 'include'`.

---

## 6. API Integration

### Shared Client — `src/api/axiosClient.js`

```js
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});
```

- Pre-configured with base URL from `.env`
- `withCredentials: true` — sends HTTP-only cookies on every request
- **Response Interceptor:** Logs server errors and network errors to console

### API Service Modules (7 files)

| Module | Client Used | Endpoints |
|---|---|---|
| `authApi.js` | Own instance (hardcoded URL, withCredentials) | `POST /register`, `POST /login`, `POST /logout`, `GET /refresh`, `GET /me` |
| `medicinesApi.js` | Shared `axiosClient` | `GET /medicines`, `GET /medicines/max-price`, `GET /medicines/filters`, `GET /categories`, `GET /medicines/restricted` |
| `orderApi.js` | Shared `axiosClient` | `POST /orders`, `GET /orders`, `GET /orders/:id`, `PUT /orders/:id/cancel` |
| `paymentApi.js` | Shared `axiosClient` | `POST /payments/create`, `POST /payments/execute`, `GET /payments/query/:id`, `GET /payments/status/:orderId` |
| `presApi.js` | Shared `axiosClient` | `POST /prescriptions`, `GET /prescriptions`, `GET /prescriptions/pending`, `GET /prescriptions/:id`, `PUT /prescriptions/:id/review` |
| `adminApi.js` | Own instance (withCredentials) | `POST /auth/admin/register-staff`, `GET /admin/stats`, medicine CRUD, `GET /admin/orders`, `GET /admin/users`, order/user mutations, `GET /admin/sales` |

### Inconsistent Patterns

1. **Shared `axiosClient`** — used by `medicinesApi`, `orderApi`, `paymentApi`, `presApi`
2. **Own Axios instances** — `authApi` and `adminApi` create their own with hardcoded base URL
3. **Raw `fetch()`** — `CartContext` bypasses Axios entirely and uses native `fetch()` with `withCredentials: 'include'`

### Auth Mechanism

- Session-based authentication using HTTP-only cookies
- Backend sets `accessToken` and `refreshToken` cookies on login
- All API calls include credentials automatically via `withCredentials: true`
- JWT interceptor in `axiosClient` is commented out (prepared for future token-based auth)

---

## 7. Component Architecture

### App Wrapper Hierarchy

```
<AuthProvider>
  <CartProvider>
    <AuthCartSync />
    <BrowserRouter>
      <Header />                                    ← persistent
      <main>
        <Routes>
          <Route element={<ProtectedRoute roles={[...]} />}>
            <Route path="..." element={<Page />} />
          </Route>
          {/* public routes */}
        </Routes>
      </main>
      <Footer />                                    ← persistent
    </BrowserRouter>
  </CartProvider>
</AuthProvider>
```

### Common Components

#### `Header.jsx` — Main Navigation Header

- **Sticky top bar** with:
  - Brand logo + name ("PHARMAZen") — links to `/`
  - Search form → submits to `/products?search=...`
  - Cart button with badge count (from `CartContext.getCartCount()`)
- **Role-based UI:**
  - **Guest:** Login / Register buttons
  - **Customer:** Profile dropdown (Profile, Orders, Prescriptions, Logout) + Upload Prescription button
  - **Pharmacist:** Review Prescriptions button + Profile dropdown
  - **Admin:** Medicine count badge + Admin Panel button + Profile dropdown (Profile, Inventory, Register Staff, Logout)
- **Responsive:** Wraps to 2 rows on tablet, stacks on mobile

#### `Footer.jsx` — Site Footer

- 3-column grid layout:
  - **Location:** Dhaka, Bangladesh
  - **Contact:** Email, phone, working hours
  - **Quick Links:** Home, Products, Cart, Contact
- Social media icons (Facebook, Twitter, Instagram, LinkedIn)
- Copyright notice

#### `Loader.jsx` — Loading Spinner

- Animated medical cross: pulsing blue cross with green/blue ring pulses
- Text: "Loading medicines..."
- Used during cart fetch and other loading states

#### `SearchableSelect.jsx` — Combobox

- Text input with dropdown filtering
- Click-outside-to-close behavior
- Clear button
- Used in FiltersSidebar for generic name and company selection

### User-facing Components

#### `MedicineCard.jsx` — Product Card

- Dosage-form-dependent SVG icon (pill, bottle, syringe, spray, or default)
- Status badges: "In Stock" (green) / "Out of Stock" (red), Rx badge for prescription items
- Medicine name, generic name (parsed from description), price in BDT with unit
- "Add to Cart" button (disabled when out of stock)
- Animated hover effects: green gradient top bar overlay, lift + shadow

#### `FiltersSidebar.jsx` — Sidebar Filters

- **Desktop:** Sticky sidebar with:
  - Generic Name: `SearchableSelect`
  - Company: `SearchableSelect`
  - Category: Native `<select>` dropdown
  - Price Range: Dual range sliders (min/max, fetched from `medicinesApi.getMaxPrice()`)
  - Apply Filters / Clear All buttons
- **Mobile:** Slide-in drawer with backdrop overlay
- Filters are passed up to `ProductsPage` via callback

### Auth Components

#### `ProtectedRoute.jsx` — Route Guard

- Reads user from `AuthContext`
- States:
  - `loading` → renders `<Loader />`
  - Not authenticated → redirects to `/login`
  - Authenticated, but role not in allowed list → redirects to `/unauthorized`
  - Authenticated + correct role → renders `<Outlet />` (children)
- Used in `App.jsx` as a layout route wrapping protected pages

#### `AuthCartSync.jsx` — Cart Sync Coordinator

- Zero-render component (returns `null`)
- Registers `onLogin`/`onLogout` callbacks from `AuthContext` in `useEffect`
- On login: triggers `CartContext.syncLocalCartToBackend()` via global event/callback pattern
- Cleans up on unmount via unsubscribe functions

---

## 8. Page-by-Page Breakdown

### `HomePage.jsx` — Route: `/` (Public)

- Hero section with animated header ("Your Health, Our Priority")
- Search bar → navigates to `/products?search=...`
- Features grid: Verified Products, Best Prices, Fast Delivery (icon + description cards)
- Role-based header display, site footer

### `ProductsPage.jsx` — Route: `/products` (Public)

- Search from URL query params (`?search=...`)
- Reads search/filter params from URL on mount
- `FiltersSidebar` component for filtering
- `MedicineCard` grid layout
- Pagination (20 per page) with page navigation
- Mobile detection via `window.innerWidth` + resize listener
- Toast notifications for errors
- Loading state while fetching

### `LoginPage.jsx` — Route: `/login` (Public)

- Email/password form fields
- Error display for invalid credentials
- On success: redirects to previous page (or `/`) via `location.state.from`
- "Continue as Guest" link

### `RegisterPage.jsx` — Route: `/register` (Public)

- Name/email/password/confirm password form
- Client-side validation: password min 8 chars, alphanumeric only
- On success: auto-login via `AuthContext.register()`, redirect to `/`

### `StaffRegistrationPage.jsx` — Route: `/admin/register-staff` (Admin)

- Form to create pharmacist or admin accounts
- Role select dropdown (pharmacist / admin)
- Same validation as register
- Success/error messages
- Info section explaining staff account capabilities

### `CartPage.jsx` — Route: `/cart` (Public)

- Item list with:
  - Medicine name, unit price
  - Quantity controls (± buttons, max 5 limit)
  - Per-item total
  - Remove button
- Order summary sidebar: subtotal, free delivery, total
- "Proceed to Checkout" button
- Empty state message when no items
- Loading spinner during cart fetch

### `CheckoutPage.jsx` — Route: `/checkout` (Public)

- Order summary with itemized list
- Rx warning banner if prescription items present
- Payment method selection:
  - **bKash** (active) — full integration with create → pay → execute flow
  - Credit Card (coming soon, disabled)
  - Cash on Delivery (coming soon, disabled)
- Payment flow: create order → create payment → redirect to bKash

### `PaymentStatusPage.jsx` — Routes: `/payment/success`, `/payment/failed` (Public)

- **Success:** Green checkmark icon, order ID, transaction ID, "Continue Shopping" button
- **Failed:** Red X icon, error message, "Try Again" and "Go to Home" buttons
- Reads `orderId` and `trxId` from URL query params

### `PrescriptionsPage.jsx` — Route: `/prescriptions` (Customer)

- Lists all user's prescription submissions
- Status badges: pending (amber), approved (green), rejected (red)
- Shows: date range, doctor comments, medicine name, file links
- Reviewed-by info for approved/rejected prescriptions
- Empty state: "No prescriptions found"

### `PrescriptionUploadPage.jsx` — Route: `/upload-prescription` (Customer)

- **4-step form:**
  1. Drag-and-drop file upload (+ click to browse)
     - Accepted: JPG, PNG, PDF
     - Max 10MB per file, up to 4 files
     - File previews with remove option
  2. Medicine search: searchable dropdown of restricted (Rx) medicines
  3. Date range: start date + end date pickers
  4. Optional comments textarea
- Previous/Next navigation between steps
- Uploads via `FormData` to `POST /api/prescriptions`

### `PrescriptionReviewPage.jsx` — Route: `/review-prescriptions` (Pharmacist, Admin)

- **Split panel layout:**
  - **Left:** List of pending prescriptions showing patient name, date, medicine
  - **Right:** Detail panel with:
    - Patient info (name, email)
    - Requested medicine name
    - Uploaded file links (opens in new tab)
    - Review note textarea (required for rejection)
    - **Approve** / **Reject** buttons
- After action: refreshes the pending list

### `OrdersPage.jsx` — Route: `/orders` (Customer)

- Order cards with:
  - Order status badge: pending (blue), awaiting_prescription (amber), paid (green), cancelled (red)
  - Payment status: unpaid (amber), paid (green), failed (red)
  - Item list with quantities and prices
  - Order total
  - Cancel button (only shown for pending + unpaid orders)
- Empty state: "No orders yet"

### `ProfilePage.jsx` — Route: `/profile` (Customer, Pharmacist, Admin)

- Avatar circle with user's first letter
- User details: name, email, role (with colored badge), member since date
- Logout button

### `UnauthorizedPage.jsx` — Route: `/unauthorized` (Public)

- 403 message: "Access Denied"
- Illustration or icon
- "Go Back" and "Go to Home" buttons

### `AdminDashboard.jsx` — Route: `/admin` (Admin)

- **Tabbed interface** with 5 tabs:

| Tab | Content |
|---|---|
| **Dashboard** | 6 stats cards: Total Medicines, Orders, Users, Pending Prescriptions, Low Stock Items, Total Revenue |
| **Medicines** | Searchable table of all medicines. Add/Edit/Delete modals. Inline stock editing. Column sorting. |
| **Orders** | Filterable table (by status, payment status, user search). Order status management buttons. |
| **Sales** | Revenue summary + 4 breakdown tables: by Medicine, Generic, Company, Category (sorted descending by revenue) |
| **Users** | Table with name, email, role, order count. Role change dropdown (prevents self-role-change). |

---

## 9. Styling Approach

### CSS Modules

- Every component/page has a co-located `.module.css` file
- Styles are scoped to the component (no global leakage)
- Follows BEM-like naming within each module

### Design System (`index.css`)

CSS Custom Properties define a complete design system:

| Token | Example Values |
|---|---|
| `--primary-green` | `#7ed957` |
| `--primary-blue` | `#004aad` |
| `--gradient-blue` | `linear-gradient(135deg, #004aad, #7ed957)` |
| `--gradient-green` | `linear-gradient(135deg, #7ed957, #004aad)` |
| `--gradient-card` | `linear-gradient(135deg, #f8f9fa, #ffffff)` |
| `--shadow-sm` | `0 2px 4px rgba(0,0,0,0.05)` |
| `--radius` | `12px` |
| `--transition` | `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)` |

### Responsive Breakpoints

- `1024px` — Tablet landscape
- `767px` — Tablet portrait
- `480px` — Mobile

Components with responsive styles: Header (wraps at 1024px, stacks at 767px), Footer (stacks at 767px), FiltersSidebar (becomes slide-in drawer on mobile), all pages adapt to smaller screens.

### Theme

Medical/pharmacy theme:
- **Blue** (`#004aad`) — trust, medical professionalism
- **Green** (`#7ed957`) — health, nature, wellness
- Clean white cards with subtle shadows
- Gradient accents for visual hierarchy

---

## 10. Technology Stack Summary

| Layer | Technology |
|---|---|
| **UI Framework** | React 19 |
| **Build Tool** | Vite 7 |
| **Routing** | React Router DOM 7 |
| **HTTP Client** | Axios 1 (with raw fetch fallback) |
| **Styling** | CSS Modules + CSS Custom Properties |
| **Linting** | ESLint 9 (flat config) |
| **State Management** | React Context (no Redux/Zustand) |
| **Auth** | HTTP-only cookies (session-based) |
| **Language** | JavaScript (JSX) — no TypeScript |

## Architecture Pattern

- **Context Providers** (`AuthContext`, `CartContext`) wrap the entire app for global state
- **API modules** in `src/api/` encapsulate backend communication per domain
- **Components** follow a flat structure: `common/` (shared UI), `user/` (product-facing), `auth/` (guards), `pages/` (top-level routes)
- **CSS Modules** per component for scoped styling
- **No service layer** — API calls are made directly from components/contexts

## Known Issues / Observations

1. **Inconsistent API clients** — Three different HTTP patterns coexist: shared `axiosClient`, per-module Axios instances, and raw `fetch()`. Should be consolidated.

2. **No TypeScript usage** — `@types/react` and `@types/react-dom` are listed in devDependencies but all code is plain JSX. No type safety.

3. **Cart not cleared after order** — The checkout flow creates an order from the cart but never clears the cart afterwards (user must manually remove items).

4. **Guest cart edge case** — The `pendingItem` mechanism only stashes the first item a guest adds. If a guest adds multiple items before login, only the last-added item is captured in `pendingItem`.

5. **No proxy in Vite config** — All API calls go to absolute URL `http://localhost:5000/api`. In production, this would need to be updated or a proxy configured.

6. **Mobile detection** — `ProductsPage` uses `window.innerWidth` directly instead of CSS media queries or a custom hook, causing potential hydration issues and no debouncing on resize.

7. **Error handling** — Most pages show raw error messages from the API. Some contexts (like CartContext) silently fall back with `console.error` without user feedback.

8. **No loading states on some pages** — `LoginPage` and `RegisterPage` don't disable buttons during submission, allowing double-clicks.
