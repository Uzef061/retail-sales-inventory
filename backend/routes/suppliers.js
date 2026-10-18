const express = require('express');
const router = express.Router();
const { getSuppliers, createSupplier, updateSupplier, deleteSupplier } = require('../controllers/supplierController');
const { optionalProtect, protect, authorize } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, getSuppliers);
router.post('/', protect, authorize('ADMIN'), createSupplier);
router.put('/:id', protect, authorize('ADMIN'), updateSupplier);
router.delete('/:id', protect, authorize('ADMIN'), deleteSupplier);

module.exports = router;
