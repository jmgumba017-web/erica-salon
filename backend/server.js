// ============================================
// ERICA SALON — Main Server
// ============================================
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ CORS — allow specific origins
app.use(cors({
  origin: [
    'http://localhost:5000',
    'http://localhost:3000',
    'http://127.0.0.1:5000',
    /\.vercel\.app$/,
    /\.onrender\.com$/
  ],
  credentials: true
}));

// ============================================
// STATIC FILES
// ============================================
// ✅ Serve frontend folder
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ✅ Serve uploads folder
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ✅ Serve image folder (from frontend)
app.use('/image', express.static(path.join(__dirname, '..', 'frontend', 'image')));

// ============================================
// API ROUTES
// ============================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/services', require('./routes/services'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/feedback', require('./routes/feedback'));

// ============================================
// FRIENDLY ROUTES (walang .html sa URL)
// ============================================
app.get('/register', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'frontend', 'register.html'))
);
app.get('/login', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'frontend', 'login.html'))
);
app.get('/appointment', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'frontend', 'appointment.html'))
);
app.get('/calendar', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'frontend', 'calendar.html'))
);
app.get('/homepage', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'frontend', 'homepage.html'))
);

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Erica Salon API is running',
    timestamp: new Date().toISOString()
  });
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/homepage.html');
});

// ============================================
// 404 HANDLER (API only)
// ============================================
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// ============================================
// RATE LIMITER
// ============================================
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 registrations per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many registration attempts. Please try again later.'
  }
});

app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/resend-otp', registerLimiter);

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// START SERVER
// ============================================
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    console.log(`📊 Database: ${mongoose.connection.name}`);

    // Start reminder scheduler
    try {
      const { startReminderScheduler } = require('./utils/reminderScheduler');
      startReminderScheduler();
    } catch (err) {
      console.warn('⚠️ Scheduler not started:', err.message);
    }

    // ✅ Listen only kung HINDI Vercel (serverless)
    if (!process.env.VERCEL) {
      app.listen(PORT, () => {
        console.log('');
        console.log('🚀 ============================================');
        console.log(`🚀 Server running: http://localhost:${PORT}`);
        console.log('🚀 ============================================');
        console.log('');
        console.log('📋 Available URLs:');
        console.log(`   🏠 Home:       http://localhost:${PORT}/homepage.html`);
        console.log(`   📝 Register:   http://localhost:${PORT}/register.html`);
        console.log(`   🔐 Login:      http://localhost:${PORT}/login.html`);
        console.log(`   📅 Book:       http://localhost:${PORT}/appointment.html`);
        console.log(`   📅 Calendar:   http://localhost:${PORT}/calendar.html`);
        console.log(`   ❤️  Health:     http://localhost:${PORT}/api/health`);
        console.log('');
      });
    }
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Server shutting down...');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});

// ============================================
// EXPORT FOR VERCEL
// ============================================
module.exports = app;