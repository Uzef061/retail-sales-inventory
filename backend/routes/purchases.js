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
const { optionalProtect } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, getPurchases);
router.get('/:id', optionalProtect, getPurchaseById);
router.post('/', optionalProtect, createPurchase);
router.put('/:id', optionalProtect, updatePurchase);
router.delete('/:id', optionalProtect, deletePurchase);

// Purchase Return routes
router.post('/:id/return', optionalProtect, returnPurchase);
router.get('/:id/returns', optionalProtect, getPurchaseReturns);
router.delete('/returns/:returnId', optionalProtect, deletePurchaseReturn);
router.delete('/:id/returns/:returnId', optionalProtect, deletePurchaseReturn);

module.exports = router;
