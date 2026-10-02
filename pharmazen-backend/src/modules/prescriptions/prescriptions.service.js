const prisma = require('../../utils/prisma');
const { remainingUnits } = require('../../utils/prescriptionLimits');

/**
 * Shape a prescription for API responses.
 *
 * Phase 7b adds the limit triple (`maxQuantity` / `consumedQuantity` /
 * `remainingQuantity`) so a pharmacist can see how much of an approval is
 * already spent. `remainingQuantity` is derived rather than stored, and is
 * clamped at 0 by `remainingUnits` because historical rows can carry
 * consumed > max (the backfill records real over-use instead of hiding it).
 *
 * Additive only: every field a previous caller read is still returned.
 *
 * @param {Object} prescription - a Prisma prescription row
 * @returns {Object}
 */
function toPrescriptionDto(prescription) {
  return {
    ...prescription,
    remainingQuantity: remainingUnits(prescription),
  };
}

/**
 * Create a new prescription upload
 * @param {Object} data - Prescription data
 * @returns {Object} - Created prescription
 */
async function createPrescription(data) {
  const { userId, files, medicineId, medicineName, startDate, endDate, comment } = data;

  try {
    const prescription = await prisma.prescription.create({
      data: {
        userId,
        medicineName,
        medicineId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        comment: comment || null,
        status: 'pending',
        files: {
          create: files.map((file) => ({
            fileUrl: file.url,
            cloudinaryId: file.publicId,
          })),
        },
      },
      include: {
        files: {
          select: {
            id: true,
            fileUrl: true,
            createdAt: true,
          },
        },
      },
    });

    return toPrescriptionDto(prescription);
  } catch (error) {
    console.error('Error creating prescription:', error);
    throw new Error('Failed to create prescription');
  }
}

/**
 * Get prescriptions for a user
 * @param {String} userId - User ID
 * @returns {Array} - User's prescriptions
 */
async function getUserPrescriptions(userId) {
  try {
    const prescriptions = await prisma.prescription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: {
          select: { name: true },
        },
        files: {
          select: {
            id: true,
            fileUrl: true,
            createdAt: true,
          },
        },
      },
    });

    return prescriptions.map(toPrescriptionDto);
  } catch (error) {
    console.error('Error fetching user prescriptions:', error);
    throw new Error('Failed to fetch prescriptions');
  }
}

/**
 * Get all pending prescriptions for pharmacist review
 * @returns {Array} - Pending prescriptions with user info
 */
async function getPendingPrescriptions() {
  try {
    const prescriptions = await prisma.prescription.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        files: {
          select: {
            id: true,
            fileUrl: true,
            createdAt: true,
          },
        },
      },
    });

    return prescriptions.map(toPrescriptionDto);
  } catch (error) {
    console.error('Error fetching pending prescriptions:', error);
    throw new Error('Failed to fetch pending prescriptions');
  }
}

/**
 * Get a single prescription by ID with full details
 * @param {String} id - Prescription ID
 * @returns {Object} - Prescription with user info
 */
async function getPrescriptionById(id) {
  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        files: {
          select: {
            id: true,
            fileUrl: true,
            createdAt: true,
          },
        },
      },
    });

    if (!prescription) {
      return null;
    }

    return toPrescriptionDto(prescription);
  } catch (error) {
    console.error('Error fetching prescription:', error);
    throw new Error('Failed to fetch prescription');
  }
}

/**
 * Review a prescription (approve or reject)
 * @param {String} id - Prescription ID
 * @param {String} reviewerId - Pharmacist/Admin ID
 * @param {String} status - 'approved' or 'rejected'
 * @param {String} reviewNote - Optional note from reviewer
 * @param {Number} [maxQuantity] - Phase 7b: units the pharmacist authorises.
 *   Omitted means DEFAULT_AUTHORIZED_QUANTITY. Validated by
 *   `parseAuthorizedQuantity` in the controller.
 * @returns {Object} - Updated prescription
 */
async function reviewPrescription(id, reviewerId, status, reviewNote, maxQuantity) {
  try {
    const prescription = await prisma.prescription.update({
      where: { id },
      data: {
        status,
        reviewedBy: reviewerId,
        reviewNote: reviewNote || null,
        // Phase 7b. Only written when the reviewer stated a figure, so a review
        // that predates this field (or a client that omits it) leaves an existing
        // limit alone instead of resetting a patient's budget.
        ...(maxQuantity !== undefined && { maxQuantity }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        files: {
          select: {
            id: true,
            fileUrl: true,
            createdAt: true,
          },
        },
      },
    });

    return toPrescriptionDto(prescription);
  } catch (error) {
    console.error('Error reviewing prescription:', error);
    throw new Error('Failed to review prescription');
  }
}

module.exports = {
  createPrescription,
  getUserPrescriptions,
  getPendingPrescriptions,
  getPrescriptionById,
  reviewPrescription,
};