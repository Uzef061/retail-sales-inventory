const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user || user.isActive === false) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name || user.username,
        role: user.role || 'ADMIN'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Login error', error: error.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        username: req.user.username,
        name: req.user.name || req.user.username,
        role: req.user.role || 'ADMIN'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching profile', error: error.message });
  }
};
