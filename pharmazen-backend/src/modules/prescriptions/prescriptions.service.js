const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Create a new prescription upload
 * @param {Object} data - Prescription data
 * @returns {Object} - Created prescription
 */
async function createPrescription(data) {
  const { userId, file, medicineId, medicineName, startDate, endDate, comment } = data;

  try {
    const prescription = await prisma.prescription.create({
      data: {
        userId,
        fileUrl: file.url,
        cloudinaryId: file.publicId,
        medicineName,
        medicineId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        comment: comment || null,
        status: 'pending',
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
      },
    });

    return prescriptions;
  } catch (error) {
    console.error('Error fetching user prescriptions:', error);
    throw new Error('Failed to fetch prescriptions');
  }
}

module.exports = {
  createPrescription,
  getUserPrescriptions,
};