const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, authorize } = require('../../middleware/auth');
const { MAX_FILE_BYTES, MAX_FILES, describeUploadError } = require('../../utils/uploadLimits');
const prescriptionsController = require('./prescriptions.controller');

// Vercel rejects the whole request body over ~4.5MB before the function runs,
// so these limits are what the platform can actually deliver, not what multer
// would like to accept. The old 10MB x 4 contract was unreachable: any upload
// over ~4.5MB died at the edge with FUNCTION_PAYLOAD_TOO_LARGE, which the
// client could not distinguish from an app error. The frontend compresses images
// to fit before sending.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: MAX_FILES,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      // Wrapped as a MulterError so the controller can map it to a 400 with a
      // readable message. A plain Error here escapes as a 500 and Express
      // renders a stack trace to the client.
      const error = new multer.MulterError('INVALID_FILE_TYPE', file.fieldname);
      error.message = 'Only JPG, PNG, or PDF files are allowed';
      cb(error, false);
    }
  },
});

// All routes require authentication
router.use(authenticate);

// POST /api/prescriptions - Upload prescription with file
router.post('/', upload.array('files', MAX_FILES), prescriptionsController.uploadPrescription);

// GET /api/prescriptions - Get user prescriptions
router.get('/', prescriptionsController.getUserPrescriptions);

// Pharmacist/Admin routes
router.get('/pending', authorize('pharmacist', 'admin'), prescriptionsController.getPendingPrescriptions);
router.get('/:id', authorize('pharmacist', 'admin'), prescriptionsController.getPrescriptionById);
router.put('/:id/review', authorize('pharmacist', 'admin'), prescriptionsController.reviewPrescription);

module.exports = router;

// Must be registered last. Multer aborts with next(err), skipping the
// controller, so oversized or disallowed uploads would otherwise reach
// Express's default handler and come back as a 500 HTML page with a stack
// trace. Four arguments is what makes Express treat this as an error handler.
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: describeUploadError(err) });
  }
  next(err);
});

module.exports = router;
