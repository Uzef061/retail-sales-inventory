const express = require('express');
const router = express.Router();
const { getSmartInventory } = require('../controllers/smartInventoryController');
const { optionalProtect } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, getSmartInventory);

module.exports = router;
