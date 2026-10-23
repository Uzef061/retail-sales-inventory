const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { optionalProtect, protect, authorize } = require('../middleware/authMiddleware');

// Read operations support optionalProtect for backward compatibility with demo/public views
router.get('/', optionalProtect, saleController.getSales);
router.get('/:id', optionalProtect, saleController.getSaleById);
router.get('/:id/returns', optionalProtect, saleController.getSaleReturns);

// Mutation operations strictly enforce authentication
router.post('/', protect, saleController.createSale);
router.put('/:id', protect, saleController.updateSale);
router.put('/:id/cancel', protect, saleController.cancelSale);
router.post('/:id/cancel', protect, saleController.cancelSale);
router.post('/:id/return', protect, saleController.returnSale);
router.delete('/returns/:returnId', protect, saleController.deleteSaleReturn);
router.delete('/:id/returns/:returnId', protect, saleController.deleteSaleReturn);
router.delete('/:id', protect, saleController.deleteSale);
router.post('/bulk-delete', protect, saleController.bulkDeleteSales);

module.exports = router;
