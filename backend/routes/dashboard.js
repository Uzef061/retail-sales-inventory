const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { optionalProtect } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, dashboardController.getDashboardData);

module.exports = router;
