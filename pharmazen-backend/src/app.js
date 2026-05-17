const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();

// Import routes
const authRoutes = require('./modules/auth/auth.routes');
const medicinesRoutes = require('./modules/medicines/medicines.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const ordersRoutes = require('./modules/orders/orders.routes');
const paymentsRoutes = require('./modules/payments/payments.routes');
const prescriptionsRoutes = require('./modules/prescriptions/prescriptions.routes');
const adminRoutes = require('./modules/admin/admin.routes');

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/', (req, res) => {
  res.json({ success: true, message: 'PharmaZen API is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicinesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/prescriptions', prescriptionsRoutes);
app.use('/api/admin', adminRoutes);

module.exports = app;
