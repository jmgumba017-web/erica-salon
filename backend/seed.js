// ============================================
// ERICA SALON — Seed Data
// ============================================
require('dotenv').config();
const mongoose = require('mongoose');
const { User, Customer, Staff, Service } = require('./models');

(async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    // ============================================
    // STEP 1: CLEAR OLD DATA (Optional)
    // ============================================
    console.log('🗑️  Clearing old data...');
    await User.deleteMany({});
    await Customer.deleteMany({});
    await Staff.deleteMany({});
    await Service.deleteMany({});
    console.log('✅ Cleared\n');

    // ============================================
    // STEP 2: CREATE SERVICES
    // ============================================
    console.log('💇 Creating services...');
    
    const servicesData = [
      // HAIR
      { serviceName: 'Haircut', category: 'Hair', price: 300, duration: 30, description: 'Basic haircut with wash & blow dry' },
      { serviceName: 'Hair Color', category: 'Hair', price: 1200, duration: 120, description: 'Full hair coloring' },
      { serviceName: 'Rebond', category: 'Hair', price: 2500, duration: 180, description: 'Hair straightening treatment' },
      { serviceName: 'Keratin', category: 'Hair', price: 3000, duration: 180, description: 'Keratin smoothing treatment' },
      { serviceName: 'Hair Botox', category: 'Hair', price: 2000, duration: 120, description: 'Deep repair treatment' },
      
      // NAILS
      { serviceName: 'Nail Extension', category: 'Nails', price: 800, duration: 90, description: 'Acrylic nail extension' },
      { serviceName: 'Gel Nails', category: 'Nails', price: 600, duration: 60, description: 'Long-lasting gel polish' },
      { serviceName: 'Manicure', category: 'Nails', price: 200, duration: 30, description: 'Basic nail cleaning' },
      { serviceName: 'Pedicure', category: 'Nails', price: 250, duration: 45, description: 'Foot cleaning & polish' },
      { serviceName: 'Foot Spa', category: 'Nails', price: 450, duration: 60, description: 'Relaxing foot massage' },
      
      // SKIN
      { serviceName: 'Facial', category: 'Skin', price: 500, duration: 60, description: 'Basic facial treatment' },
      { serviceName: 'Diamond Peel', category: 'Skin', price: 1000, duration: 60, description: 'Exfoliation treatment' },
      
      // BODY
      { serviceName: 'Swedish Massage', category: 'Body', price: 600, duration: 60, description: 'Relaxing full body massage' },
      { serviceName: 'Hot Stone Massage', category: 'Body', price: 1000, duration: 90, description: 'With hot stones' },
      
      // MAKEUP
      { serviceName: 'Bridal Makeup', category: 'Makeup', price: 3000, duration: 120, description: 'Complete bridal package' }
    ];

    const services = await Service.insertMany(servicesData);
    console.log(`✅ Created ${services.length} services\n`);

    // ============================================
    // STEP 3: CREATE STAFF USERS
    // ============================================
    console.log('👥 Creating staff users...');

    const staffData = [
      { name: 'Maria Santos', email: 'maria@erica.com', specialization: ['Hair Stylist'], category: 'Hair' },
      { name: 'Ana Cruz', email: 'ana@erica.com', specialization: ['Nail Technician'], category: 'Nails' },
      { name: 'Pedro Reyes', email: 'pedro@erica.com', specialization: ['Massage Therapist'], category: 'Body' },
      { name: 'Lisa Tan', email: 'lisa@erica.com', specialization: ['Skin Specialist'], category: 'Skin' }
    ];

    const createdStaff = [];
    
    for (const data of staffData) {
      // Create user account
      const user = await User.create({
        name: data.name,
        email: data.email,
        password: 'staff123',
        role: 'Staff',
        contactNumber: '09171234567',
        status: 'Active'
      });

      // Get services for this specialization
      const staffServices = services
        .filter(s => s.category === data.category)
        .map(s => s._id);

      // Create staff profile
      const staff = await Staff.create({
        userId: user._id,
        name: user.name,
        contactNumber: user.contactNumber,
        specialization: data.specialization,
        services: staffServices,
        photo: '',
        bio: `${data.specialization[0]} with years of experience`,
        status: 'Available'
      });

      createdStaff.push(staff);
      console.log(`   ✅ ${user.name} (${data.specialization[0]})`);
    }
    console.log(`\n✅ Created ${createdStaff.length} staff\n`);

    // ============================================
    // STEP 4: CREATE ADMIN USER
    // ============================================
    console.log('👑 Creating admin user...');

    const admin = await User.create({
      name: 'Erica Reyes',
      email: 'admin@erica.com',
      password: 'admin123',
      role: 'Admin',
      contactNumber: '09171234567',
      status: 'Active'
    });

    console.log(`✅ Admin created: ${admin.name} (${admin.email})\n`);

    // ============================================
    // STEP 5: CREATE SAMPLE CUSTOMERS
    // ============================================
    console.log('👤 Creating sample customers...');

    const customersData = [
      { name: 'John Michael', email: 'john@email.com', contactNumber: '09171234567' },
      { name: 'Jane Smith', email: 'jane@email.com', contactNumber: '09181234567' }
    ];

    for (const data of customersData) {
      const user = await User.create({
        name: data.name,
        email: data.email,
        password: 'customer123',
        role: 'Customer',
        contactNumber: data.contactNumber,
        status: 'Active'
      });

      await Customer.create({
        userId: user._id,
        name: user.name,
        email: user.email,
        contactNumber: user.contactNumber,
        notes: ''
      });

      console.log(`   ✅ ${user.name} (${data.email})`);
    }

    // ============================================
    // DONE!
    // ============================================
    console.log('\n🎉 ============================================');
    console.log('🎉 SEED COMPLETE!');
    console.log('🎉 ============================================');
    console.log('\n📊 Summary:');
    console.log(`   👑 Admins:     1`);
    console.log(`   👥 Staff:      ${createdStaff.length}`);
    console.log(`   👤 Customers:  2`);
    console.log(`   💇 Services:   ${services.length}`);
    console.log('\n📧 Login Credentials:');
    console.log('   Admin:   admin@erica.com / admin123');
    console.log('   Staff:   maria@erica.com / staff123');
    console.log('   Customer: john@email.com / customer123');
    console.log('');

    process.exit();
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  }
})();
