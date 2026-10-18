const express = require('express');
const router = express.Router();
const { login, googleLogin, getMe, completeOnboarding } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', protect, getMe);
router.put('/onboarding', protect, completeOnboarding);

module.exports = router;
