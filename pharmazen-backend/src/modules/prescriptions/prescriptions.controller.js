const prescriptionsService = require('./prescriptions.service');
const { parseAuthorizedQuantity } = require('../../utils/prescriptionLimits');
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * POST /api/prescriptions
 * Upload prescription with file and details
 */
async function uploadPrescription(req, res) {
  try {
    const userId = req.user.id;
    const { medicineId, medicineName, startDate, endDate, comment } = req.body;
    const files = req.files;

    if (!files || files.length === 0 || !medicineId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Please provide at least one prescription file, medicine, and time duration.',
      });
    }

    if (files.length > 4) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 4 files allowed.',
      });
    }

    // Upload all files to Cloudinary in parallel
    const uploadResults = await Promise.all(
      files.map((file) =>
        new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'pharmazen/prescriptions' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          streamifier.createReadStream(file.buffer).pipe(uploadStream);
        })
      )
    );

    const prescription = await prescriptionsService.createPrescription({
      userId,
      files: uploadResults.map((result) => ({
        url: result.secure_url,
        publicId: result.public_id,
      })),
      medicineId,
      medicineName,
      startDate,
      endDate,
      comment,
    });

    res.status(201).json({
      success: true,
      data: prescription,
    });
  } catch (error) {
    console.error('Error in uploadPrescription controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload prescription. Please try again.',
    });
  }
}

/**
 * GET /api/prescriptions
 * Get current user's prescriptions
 */
async function getUserPrescriptions(req, res) {
  try {
    const userId = req.user.id;
    const prescriptions = await prescriptionsService.getUserPrescriptions(userId);

    res.json({
      success: true,
      data: prescriptions,
    });
  } catch (error) {
    console.error('Error in getUserPrescriptions controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prescriptions.',
    });
  }
}

/**
 * GET /api/prescriptions/pending
 * Get all pending prescriptions (pharmacist/admin only)
 */
async function getPendingPrescriptions(req, res) {
  try {
    const prescriptions = await prescriptionsService.getPendingPrescriptions();

    res.json({
      success: true,
      data: prescriptions,
    });
  } catch (error) {
    console.error('Error in getPendingPrescriptions controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending prescriptions.',
    });
  }
}

/**
 * GET /api/prescriptions/:id
 * Get a single prescription by ID (pharmacist/admin only)
 */
async function getPrescriptionById(req, res) {
  try {
    const { id } = req.params;
    const prescription = await prescriptionsService.getPrescriptionById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found.',
      });
    }

    res.json({
      success: true,
      data: prescription,
    });
  } catch (error) {
    console.error('Error in getPrescriptionById controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prescription.',
    });
  }
}

/**
 * PUT /api/prescriptions/:id/review
 * Review a prescription - approve or reject (pharmacist/admin only)
 */
async function reviewPrescription(req, res) {
  try {
    const { id } = req.params;
    const { status, reviewNote } = req.body;
    const reviewerId = req.user.id;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be either "approved" or "rejected".',
      });
    }

    // Phase 7b: the pharmacist states how many units this approval authorises.
    // parseAuthorizedQuantity rejects a non-integer, a zero, a negative and
    // anything above MAX_AUTHORIZED_QUANTITY with a 400, so a typo cannot
    // silently authorise an absurd allowance. It throws .status = 400, which
    // the catch below honours rather than converting to a 500.
    let maxQuantity;
    try {
      const hasLimit = Object.prototype.hasOwnProperty.call(req.body, 'maxQuantity');
      maxQuantity = hasLimit ? parseAuthorizedQuantity(req.body.maxQuantity) : undefined;
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    const prescription = await prescriptionsService.getPrescriptionById(id);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found.',
      });
    }

    if (prescription.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Prescription has already been reviewed.',
      });
    }

    const updated = await prescriptionsService.reviewPrescription(id, reviewerId, status, reviewNote, maxQuantity);

    res.json({
      success: true,
      data: updated,
      message: `Prescription ${status} successfully.`,
    });
  } catch (error) {
    console.error('Error in reviewPrescription controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to review prescription.',
    });
  }
}

module.exports = {
  uploadPrescription,
  getUserPrescriptions,
  getPendingPrescriptions,
  getPrescriptionById,
  reviewPrescription,
};