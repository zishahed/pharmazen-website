const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

    return prescription;
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

    return prescriptions;
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

    return prescriptions;
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

    return prescription;
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
 * @returns {Object} - Updated prescription
 */
async function reviewPrescription(id, reviewerId, status, reviewNote) {
  try {
    const prescription = await prisma.prescription.update({
      where: { id },
      data: {
        status,
        reviewedBy: reviewerId,
        reviewNote: reviewNote || null,
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

    return prescription;
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