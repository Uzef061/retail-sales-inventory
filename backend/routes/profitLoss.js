const express = require('express');
const router = express.Router();
const profitLossController = require('../controllers/profitLossController');
const { optionalProtect } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, profitLossController.getProfitLoss);

module.exports = router;
