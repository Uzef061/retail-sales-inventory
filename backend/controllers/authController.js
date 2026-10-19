const User = require('../models/User');
const BusinessProfile = require('../models/BusinessProfile');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
};

// POST /api/auth/login (Standard Username & Password Login)
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const user = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: username.trim().toLowerCase() }
      ]
    });

    if (!user || user.isActive === false) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const token = generateToken(user._id);

    // Ensure business profile exists
    let profile = await BusinessProfile.findOne({ userId: user._id });
    if (!profile) {
      profile = await BusinessProfile.create({
        userId: user._id,
        businessName: user.name ? `${user.name}'s Store` : 'My Store',
        ownerName: user.name || '',
        currency: '₹'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name || user.username,
        avatar: user.avatar,
        role: user.role || 'ADMIN',
        hasCompletedOnboarding: Boolean(user.hasCompletedOnboarding),
        businessId: profile._id
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Login error', error: error.message });
  }
};

// POST /api/auth/google (Server-side Google ID Token Verification)
exports.googleLogin = async (req, res) => {
  try {
    const { idToken, token } = req.body;
    const tokenToVerify = idToken || token;

    if (!tokenToVerify) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required.',
        errorCode: 'MISSING_GOOGLE_TOKEN'
      });
    }

    let payload;

    // In automated unit/integration test environment ONLY (NODE_ENV === 'test'), allow controlled mock token
    if (
      process.env.NODE_ENV === 'test' &&
      typeof tokenToVerify === 'string' &&
      tokenToVerify.startsWith('mock_test_token_')
    ) {
      const parts = tokenToVerify.split('_');
      payload = {
        sub: `mock_google_id_${parts[3] || '001'}`,
        email: parts[4] ? `${parts[4]}@test.com` : 'shopowner@test.com',
        name: parts[5] || 'Test Shopkeeper',
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        email_verified: true,
        iss: 'https://accounts.google.com'
      };
    } else {
      // Real cryptographic token verification via Google OAuth2 Client
      try {
        const allowedAudiences = [
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_WEB_CLIENT_ID,
          process.env.GOOGLE_ANDROID_CLIENT_ID
        ].filter(Boolean);

        const ticket = await googleClient.verifyIdToken({
          idToken: tokenToVerify,
          audience: allowedAudiences.length > 0 ? (allowedAudiences.length === 1 ? allowedAudiences[0] : allowedAudiences) : undefined
        });
        payload = ticket.getPayload();
      } catch (verifyErr) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Google authentication token: ' + verifyErr.message,
          errorCode: 'INVALID_GOOGLE_TOKEN'
        });
      }
    }

    if (!payload) {
      return res.status(401).json({
        success: false,
        message: 'Google authentication failed: Empty token payload.',
        errorCode: 'INVALID_GOOGLE_TOKEN'
      });
    }

    // Validate Issuer
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token issuer.',
        errorCode: 'INVALID_GOOGLE_ISSUER'
      });
    }

    // Validate verified email
    if (!payload.email) {
      return res.status(400).json({
        success: false,
        message: 'Google token does not contain an email address.',
        errorCode: 'GOOGLE_EMAIL_MISSING'
      });
    }

    if (payload.email_verified !== true) {
      return res.status(401).json({
        success: false,
        message: 'Google account email is not verified.',
        errorCode: 'GOOGLE_EMAIL_UNVERIFIED'
      });
    }

    const { sub: googleId, email, name, picture, email_verified } = payload;

    // Check if user exists by googleId or verified email
    let user = await User.findOne({
      $or: [{ googleId }, { email: email.toLowerCase() }]
    });

    let isNewUser = false;

    if (user) {
      // Link Google ID if not already linked (only if email was verified by Google)
      if (!user.googleId && email_verified) {
        user.googleId = googleId;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
      }
      if (!user.name && name) {
        user.name = name;
      }
      await user.save();
    } else {
      // Create new tenant user account
      isNewUser = true;
      user = await User.create({
        googleId,
        email: email.toLowerCase(),
        username: email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 6),
        name: name || 'Business Owner',
        avatar: picture || '',
        role: 'ADMIN',
        hasCompletedOnboarding: false,
        isActive: true
      });
    }

    // Ensure business profile exists for this tenant
    let profile = await BusinessProfile.findOne({ userId: user._id });
    if (!profile) {
      profile = await BusinessProfile.create({
        userId: user._id,
        businessName: name ? `${name}'s Store` : 'My Store',
        ownerName: name || '',
        email: email || '',
        currency: '₹'
      });
    }

    const sessionToken = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Google login successful',
      token: sessionToken,
      isNewUser: Boolean(isNewUser),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name || user.username,
        avatar: user.avatar,
        role: user.role || 'ADMIN',
        hasCompletedOnboarding: Boolean(user.hasCompletedOnboarding),
        isNewUser: Boolean(isNewUser),
        businessId: profile._id
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing Google authentication',
      error: error.message
    });
  }
};

// PUT /api/auth/onboarding (Completes onboarding and optionally sets initial store profile)
exports.completeOnboarding = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { businessName, category, phone, currency, ownerName } = req.body;

    req.user.hasCompletedOnboarding = true;
    await req.user.save();

    let profile = await BusinessProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = new BusinessProfile({ userId: req.user._id });
    }

    if (businessName && businessName.trim()) profile.businessName = businessName.trim();
    if (category && category.trim()) profile.category = category.trim();
    if (phone && phone.trim()) profile.phone = phone.trim();
    if (currency && currency.trim()) profile.currency = currency.trim();
    if (ownerName && ownerName.trim()) profile.ownerName = ownerName.trim();

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Onboarding completed successfully',
      hasCompletedOnboarding: true,
      profile
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating onboarding state', error: error.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }

    let profile = await BusinessProfile.findOne({ userId: req.user._id });

    res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        name: req.user.name || req.user.username,
        avatar: req.user.avatar,
        role: req.user.role || 'ADMIN',
        hasCompletedOnboarding: Boolean(req.user.hasCompletedOnboarding),
        businessId: profile ? profile._id : null
      },
      profile
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching profile', error: error.message });
  }
};
