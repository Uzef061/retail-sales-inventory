const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledgerController');
const { optionalProtect } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, ledgerController.getLedger);

module.exports = router;
