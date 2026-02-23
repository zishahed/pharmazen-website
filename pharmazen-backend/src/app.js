const express = require('express');
const cors = require('cors');
const app = express();

// Import routes
const medicinesRoutes = require('./modules/medicines/medicines.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ success: true, message: 'PharmaZen API is running' });
});

// API Routes
app.use('/api/medicines', medicinesRoutes);
app.use('/api/categories', categoriesRoutes);

module.exports = app;