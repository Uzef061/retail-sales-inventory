const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Validates security-critical environment variables at application startup.
 * Fails safely if required secrets are missing, without leaking or logging any secrets.
 */
const validateSecurityConfig = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
    throw new Error(
      '[FATAL SECURITY CONFIGURATION ERROR] JWT_SECRET environment variable is missing or empty. ' +
      'Application cannot start safely without a configured JWT secret.'
    );
  }
};

/**
 * Retrieves the configured JWT secret dynamically.
 * Throws a configuration error if not set, preventing any fallback to insecure hardcoded secrets.
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    const err = new Error('JWT_SECRET environment variable is not configured');
    err.code = 'CONFIG_ERROR';
    throw err;
  }
  return secret;
};

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
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
        errorCode: 'AUTH_REQUIRED'
      });
    }

    let secret;
    try {
      secret = getJwtSecret();
    } catch (cfgErr) {
      return res.status(500).json({
        success: false,
        message: 'Server security configuration error: Authentication secret is not configured.',
        errorCode: 'AUTH_CONFIG_ERROR'
      });
    }

    token = token.replace(/^["']|["']$/g, '').trim();
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id).select('-password');

    if (!user || user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive or invalid.',
        errorCode: 'INVALID_USER'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
      errorCode: 'TOKEN_EXPIRED'
    });
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
      let secret;
      try {
        secret = getJwtSecret();
      } catch (cfgErr) {
        return next();
      }

      token = token.replace(/^["']|["']$/g, '').trim();
      const decoded = jwt.verify(token, secret);
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive !== false) {
        req.user = user;
      }
    }
  } catch (err) {
    // Ignore invalid token in optionalProtect for public/demo fallback endpoints
  }
  next();
};

module.exports = {
  protect,
  authorize,
  optionalProtect,
  validateSecurityConfig,
  getJwtSecret,
  get JWT_SECRET() {
    return getJwtSecret();
  }
};
