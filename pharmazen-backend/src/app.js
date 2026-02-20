const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ success: true, message: 'PharmaZen API is running' });
});

module.exports = app;