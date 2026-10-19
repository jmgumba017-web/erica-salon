const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB\n');

    // Hanapin lahat ng Admin users
    const admins = await User.find({ role: 'Admin' });

    if (admins.length === 0) {
      console.log('❌ Walang Admin account sa database');
      console.log('💡 Gumawa ng bago gamit ang create-my-admin.js');
    } else {
      console.log('👑 Admin accounts found:', admins.length);
      console.log('=================================');
      admins.forEach((admin, i) => {
        console.log(\n. );
        console.log('   📧 Email:    ', admin.email);
        console.log('   👤 Role:     ', admin.role);
        console.log('   ✅ Verified: ', admin.isVerified);
        console.log('   🔒 Hashed PW:', admin.password.substring(0, 30) + '...');
        console.log('   📅 Created:  ', admin.createdAt);
      });
      console.log('\n=================================');
    }

    // Hanapin din lahat ng users para makita kung may naka-set na admin
    console.log('\n📋 LAHAT NG USERS:');
    console.log('=================================');
    const allUsers = await User.find({});
    allUsers.forEach((u, i) => {
      console.log(${i + 1}.  | role:  | verified: );
    });

    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
