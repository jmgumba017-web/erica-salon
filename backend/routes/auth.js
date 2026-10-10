const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { User, Customer, OTP } = require('../models');             // ✅
const { sendOTPEmail, sendPasswordResetEmail } = require('../utils/emailService');  // ✅
const validator = require('validator');
const dns = require('dns').promises;

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ============================================
// HELPER: Verify Email Domain (MX Record)
// ============================================
async function verifyEmailDomain(email) {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;

    const mxRecords = await dns.resolveMx(domain);

    if (!mxRecords || mxRecords.length === 0) {
      return false;
    }

    return true;
  } catch (err) {
    console.error('❌ MX lookup error:', err.message);
    return false;
  }
}

// ============================================
// HELPER: Check Disposable Email
// ============================================
function isDisposableEmail(email) {
  const disposableDomains = [
    'tempmail.com', 'guerrillamail.com', '10minutemail.com',
    'mailinator.com', 'throwawaymail.com', 'yopmail.com',
    'fakeinbox.com', 'trashmail.com', 'temp-mail.org',
    'getnada.com', 'sharklasers.com', 'maildrop.cc',
    'guerrillamail.net', 'guerrillamail.org', 'mailnesia.com',
    'spamgourmet.com', 'trashmail.net', 'mintemail.com',
    'getairmail.com', 'throwaway.email', 'tempinbox.com',
    'emailondeck.com', 'mohmal.com', 'tempail.com',
    'burnermail.io', '33mail.com'
  ];

  const domain = email.split('@')[1]?.toLowerCase();
  return disposableDomains.includes(domain);
}

// ============================================
// HELPER: Check Email Exists (MailRambo)
// ============================================
async function checkEmailExists(email) {
  try {
    if (!process.env.MAILRAMBO_API_KEY) {
      console.warn('⚠️ MAILRAMBO_API_KEY not set — skipping');
      return { valid: true, reason: 'not-checked' };
    }

    const res = await axios.post(
      'https://www.mailrambo.com/v1/verify',
      { email: email },
      {
        headers: {
          'Authorization': `Bearer ${process.env.MAILRAMBO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    const data = res.data;

    console.log(`📧 MailRambo check for ${email}:`, {
      deliverable: data.deliverable,
      reason: data.reason,
      credits_remaining: data.credits_remaining
    });

    if (data.deliverable === false) {
      let message = 'Email address does not exist. Please use a valid email.';

      if (data.reason === 'disposable') {
        message = 'Disposable emails are not allowed. Please use a valid email.';
      } else if (data.reason === 'invalid_syntax') {
        message = 'Invalid email format. Please check your email.';
      } else if (data.reason === 'invalid_domain') {
        message = 'Email domain does not exist. Please check your email.';
      }

      return { valid: false, reason: message };
    }

    return { valid: true, reason: 'valid' };

  } catch (err) {
    console.error('❌ MailRambo API error:', err.message);
    return { valid: true, reason: 'api-error' };
  }
}

// ============================================
// HELPER: Generate JWT
// ============================================
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// ============================================
// HELPER: Generate 6-digit OTP
// ============================================
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ============================================
// POST /api/auth/register
// ============================================
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, contactNumber } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all required fields'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (isDisposableEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Disposable emails are not allowed. Please use a valid email address.'
      });
    }

    console.log(`🔍 Checking MX record for: ${email}`);
    const domainValid = await verifyEmailDomain(email);

    if (!domainValid) {
      return res.status(400).json({
        success: false,
        message: 'Email domain does not exist or cannot receive emails. Please check your email address.'
      });
    }

    if (process.env.MAILRAMBO_API_KEY) {
      console.log(`🔍 Verifying email exists: ${email}`);
      const emailCheck = await checkEmailExists(email);

      if (!emailCheck.valid) {
        return res.status(400).json({
          success: false,
          message: emailCheck.reason
        });
      }
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    await OTP.deleteMany({ email: email.toLowerCase(), purpose: 'register' });

    const otpCode = generateOTP();

    await OTP.create({
      email: email.toLowerCase(),
      code: otpCode,
      purpose: 'register',
      userData: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: password,
        contactNumber: contactNumber || '',
        role: 'Customer'
      },
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    const emailResult = await sendOTPEmail(email, name, otpCode);

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again.'
      });
    }

    res.json({
      success: true,
      message: `OTP sent to ${email}. Please check your inbox.`,
      email: email.toLowerCase(),
      requiresOTP: true
    });

  } catch (err) {
    console.error('❌ Register error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// ============================================
// POST /api/auth/verify-otp
// ============================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP code are required'
      });
    }

    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      purpose: 'register'
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found. Please register again.'
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please register again.'
      });
    }

    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please register again.'
      });
    }

    if (otpRecord.code !== code.toString().trim()) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${5 - otpRecord.attempts} attempts remaining.`
      });
    }

    const userData = otpRecord.userData;

    const user = await User.create({
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role || 'Customer',
      contactNumber: userData.contactNumber || '',
      status: 'Active'
    });

    if (user.role === 'Customer') {
      await Customer.create({
        userId: user._id,
        name: user.name,
        email: user.email,
        contactNumber: user.contactNumber,
        notes: ''
      });
    }

    await OTP.deleteOne({ _id: otpRecord._id });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        contactNumber: user.contactNumber
      }
    });

  } catch (err) {
    console.error('❌ Verify OTP error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// ============================================
// POST /api/auth/resend-otp
// ============================================
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      purpose: 'register'
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'No pending registration. Please register again.'
      });
    }

    const newCode = generateOTP();
    otpRecord.code = newCode;
    otpRecord.attempts = 0;
    otpRecord.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await otpRecord.save();

    await sendOTPEmail(email, otpRecord.userData.name, newCode);

    res.json({
      success: true,
      message: 'New OTP sent to your email.'
    });

  } catch (err) {
    console.error('❌ Resend OTP error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// POST /api/auth/login
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact admin.`
      });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        contactNumber: user.contactNumber
      }
    });

  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// ============================================
// POST /api/auth/forgot-password
// Send OTP for password reset
// ============================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({
        success: true,
        message: 'Kung existing ang email na ito, may matatanggap kang OTP. I-check ang inbox mo.',
        requiresOTP: true,
        email: email.toLowerCase()
      });
    }

    await OTP.deleteMany({ email: email.toLowerCase(), purpose: 'reset-password' });

    const otpCode = generateOTP();

    await OTP.create({
      email: email.toLowerCase(),
      code: otpCode,
      purpose: 'reset-password',
      userData: {
        userId: user._id,
        email: user.email
      },
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    const emailResult = await sendOTPEmail(user.email, user.name, otpCode);

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again.'
      });
    }

    console.log(`🔐 Password reset OTP sent to: ${user.email}`);

    res.json({
      success: true,
      message: 'Kung existing ang email na ito, may matatanggap kang OTP. I-check ang inbox mo.',
      requiresOTP: true,
      email: email.toLowerCase()
    });

  } catch (err) {
    console.error('❌ Forgot password error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// ============================================
// POST /api/auth/verify-reset-otp
// Verify OTP before resetting password
// ============================================
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP code are required'
      });
    }

    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      purpose: 'reset-password'
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found. Please request a new one.'
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new one.'
      });
    }

    if (otpRecord.code !== code.toString().trim()) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${5 - otpRecord.attempts} attempts remaining.`
      });
    }

    res.json({
      success: true,
      message: 'OTP verified! You can now set a new password.'
    });

  } catch (err) {
    console.error('❌ Verify reset OTP error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// ============================================
// POST /api/auth/reset-password
// Verify OTP + Set new password
// ============================================
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;

    if (!email || !code || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      purpose: 'reset-password'
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found. Please request a new one.'
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new one.'
      });
    }

    if (otpRecord.code !== code.toString().trim()) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${5 - otpRecord.attempts} attempts remaining.`
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.password = newPassword;
    await user.save();

    await OTP.deleteOne({ _id: otpRecord._id });

    console.log(`✅ Password reset successful for: ${user.email}`);

    res.json({
      success: true,
      message: 'Password reset successful! You can now login with your new password.'
    });

  } catch (err) {
    console.error('❌ Reset password error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// ============================================
// POST /api/auth/google
// ============================================
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'No credential provided' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture, email_verified } = payload;

    if (!email_verified) {
      return res.status(400).json({ success: false, message: 'Email not verified by Google' });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false;

    if (!user) {
      user = await User.create({
        name,
        email: email.toLowerCase(),
        password: Math.random().toString(36).slice(-16),
        role: 'Customer',
        status: 'Active'
      });

      await Customer.create({
        userId: user._id,
        name: user.name,
        email: user.email,
        contactNumber: '',
        notes: `Registered via Google (${googleId})`
      });

      isNewUser = true;
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: isNewUser ? 'Registration successful via Google!' : 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        picture: picture || ''
      }
    });

  } catch (err) {
    console.error('❌ Google auth error:', err);
    res.status(401).json({
      success: false,
      message: 'Invalid Google token: ' + err.message
    });
  }
});

module.exports = router;