const express = require('express');
const router = express.Router();
const {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierLedger
} = require('../controllers/supplierController');
const { optionalProtect } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, getSuppliers);
router.get('/:id/ledger', optionalProtect, getSupplierLedger);
router.get('/:id/statement', optionalProtect, getSupplierLedger);
router.post('/', optionalProtect, createSupplier);
router.put('/:id', optionalProtect, updateSupplier);
router.delete('/:id', optionalProtect, deleteSupplier);

module.exports = router;
