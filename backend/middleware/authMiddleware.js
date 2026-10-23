const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'retail_manager_jwt_secret_key_2026';

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers.authorization) {
      token = req.headers.authorization;
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please log in.', errorCode: 'AUTH_REQUIRED' });
    }

    token = token.replace(/^["']|["']$/g, '').trim();
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user || user.isActive === false) {
      return res.status(401).json({ success: false, message: 'User account is inactive or invalid.', errorCode: 'INVALID_USER' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.', errorCode: 'TOKEN_EXPIRED' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. ${roles.join(' or ')} permission required.`,
        errorCode: 'FORBIDDEN'
      });
    }
    next();
  };
};

const optionalProtect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers.authorization) {
      token = req.headers.authorization;
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }
    if (token) {
      token = token.replace(/^["']|["']$/g, '').trim();
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive !== false) {
        req.user = user;
      }
    }
  } catch (err) {
    // Ignore invalid token in optionalProtect
  }
  next();
};

module.exports = { protect, authorize, optionalProtect, JWT_SECRET };
