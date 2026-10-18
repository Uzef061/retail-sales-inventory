const express = require('express');
const router = express.Router();
const { getPurchases, createPurchase } = require('../controllers/purchaseController');
const { optionalProtect } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, getPurchases);
router.post('/', optionalProtect, createPurchase);

module.exports = router;
