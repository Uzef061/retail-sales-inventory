const express = require('express');
const router = express.Router();
const {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierLedger
} = require('../controllers/supplierController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');

// Read operations
router.get('/', optionalProtect, getSuppliers);
router.get('/:id/ledger', optionalProtect, getSupplierLedger);
router.get('/:id/statement', optionalProtect, getSupplierLedger);

// Mutation operations strictly require authentication
router.post('/', protect, createSupplier);
router.put('/:id', protect, updateSupplier);
router.delete('/:id', protect, deleteSupplier);

module.exports = router;
