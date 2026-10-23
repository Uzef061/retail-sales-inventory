const express = require('express');
const router = express.Router();
const {
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  deletePurchase,
  returnPurchase,
  getPurchaseReturns,
  deletePurchaseReturn
} = require('../controllers/purchaseController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');

// Read operations support optionalProtect for backward compatibility with demo/public views
router.get('/', optionalProtect, getPurchases);
router.get('/:id', optionalProtect, getPurchaseById);
router.get('/:id/returns', optionalProtect, getPurchaseReturns);

// Mutation operations strictly require authentication
router.post('/', protect, createPurchase);
router.put('/:id', protect, updatePurchase);
router.delete('/:id', protect, deletePurchase);

// Purchase Return routes strictly require authentication
router.post('/:id/return', protect, returnPurchase);
router.delete('/returns/:returnId', protect, deletePurchaseReturn);
router.delete('/:id/returns/:returnId', protect, deletePurchaseReturn);

module.exports = router;
