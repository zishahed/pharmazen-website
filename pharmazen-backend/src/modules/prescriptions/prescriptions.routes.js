const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, authorize } = require('../../middleware/auth');
const prescriptionsController = require('./prescriptions.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed'), false);
    }
  },
});

// All routes require authentication
router.use(authenticate);

// POST /api/prescriptions - Upload prescription with file
router.post('/', upload.array('files', 4), prescriptionsController.uploadPrescription);

// GET /api/prescriptions - Get user prescriptions
router.get('/', prescriptionsController.getUserPrescriptions);

// Pharmacist/Admin routes
router.get('/pending', authorize('pharmacist', 'admin'), prescriptionsController.getPendingPrescriptions);
router.get('/:id', authorize('pharmacist', 'admin'), prescriptionsController.getPrescriptionById);
router.put('/:id/review', authorize('pharmacist', 'admin'), prescriptionsController.reviewPrescription);

module.exports = router;