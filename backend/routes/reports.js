const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { optionalProtect } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, reportController.getReports);

module.exports = router;
