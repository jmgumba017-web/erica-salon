const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

// ============================================
// ADMIN CREDENTIALS
// ============================================
const email = 'adminerica285@gmail.com';
const newPassword = 'EricaSalon!Admin#2026$Secure';
// ============================================

mongoose.connect(process.env.MONGODB_URI)
  .then(async function() {
    console.log('✅ Connected to MongoDB');

    let user = await User.findOne({ email: email });

    if (!user) {
      console.log('⚠️  User not found. Creating new admin account...');
      user = await User.create({
        name: 'Admin Erica',
        email: email,
        password: await bcrypt.hash(newPassword, 10),
        role: 'Admin',
        isVerified: true
      });
      console.log('✅ Admin account CREATED');
    } else {
      user.password = await bcrypt.hash(newPassword, 10);
      user.role = 'Admin';
      user.isVerified = true;
      await user.save();
      console.log('✅ Password RESET successful');
    }

    console.log('');
    console.log('=================================');
    console.log('📧 Email:     ' + email);
    console.log('🔑 Password:  ' + newPassword);
    console.log('👤 Role:      ' + user.role);
    console.log('✅ Verified:  ' + user.isVerified);
    console.log('=================================');
    process.exit(0);
  })
  .catch(function(err) {
    console.error('❌ Error: ' + err.message);
    process.exit(1);
  });