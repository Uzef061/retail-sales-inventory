const express = require('express');
const router = express.Router();
const { getInventoryLedger } = require('../controllers/inventoryLedgerController');
const { optionalProtect } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, getInventoryLedger);

module.exports = router;
