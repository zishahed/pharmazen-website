const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedAdmins() {
  console.log('🌱 Seeding admin and staff accounts...');

  try {
    // Create Admin Account
    const adminPassword = await bcrypt.hash('admin123', 12);
    
    const admin = await prisma.user.upsert({
      where: { email: 'admin@pharmazen.com' },
      update: {},
      create: {
        name: 'System Admin',
        email: 'admin@pharmazen.com',
        passwordHash: adminPassword,
        role: 'admin',
      },
    });

    console.log('✅ Admin account created:');
    console.log('   Email: admin@pharmazen.com');
    console.log('   Password: admin123');
    console.log('   Role:', admin.role);

    // Create Sample Pharmacist Account
    const pharmacistPassword = await bcrypt.hash('pharmacist123', 12);
    
    const pharmacist = await prisma.user.upsert({
      where: { email: 'pharmacist@pharmazen.com' },
      update: {},
      create: {
        name: 'John Pharmacist',
        email: 'pharmacist@pharmazen.com',
        passwordHash: pharmacistPassword,
        role: 'pharmacist',
      },
    });

    console.log('✅ Pharmacist account created:');
    console.log('   Email: pharmacist@pharmazen.com');
    console.log('   Password: pharmacist123');
    console.log('   Role:', pharmacist.role);

    console.log('\n🎉 Seeding completed successfully!');
    console.log('\n📝 You can now login with these credentials to test the system.');
  } catch (error) {
    console.error('❌ Error seeding admins:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmins()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
