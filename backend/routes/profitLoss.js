const express = require('express');
const router = express.Router();
const profitLossController = require('../controllers/profitLossController');

router.get('/', profitLossController.getProfitLoss);

module.exports = router;
