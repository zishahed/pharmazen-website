const prescriptionsService = require('./prescriptions.service');
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');

/**
 * POST /api/prescriptions
 * Upload prescription with file and details
 */
async function uploadPrescription(req, res) {
  try {
    const userId = req.user.id;
    const { medicineId, medicineName, startDate, endDate, comment } = req.body;
    const file = req.file;

    if (!file || !medicineId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Please provide prescription file, medicine, and time duration.',
      });
    }

    // Upload file to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'pharmazen/prescriptions' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });

    const prescription = await prescriptionsService.createPrescription({
      userId,
      file: {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      },
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

module.exports = {
  uploadPrescription,
  getUserPrescriptions,
};