const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { optionalProtect, protect, authorize } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, saleController.getSales);
router.get('/:id', optionalProtect, saleController.getSaleById);
router.post('/', optionalProtect, saleController.createSale);
router.put('/:id', optionalProtect, saleController.updateSale);
router.put('/:id/cancel', optionalProtect, saleController.cancelSale);
router.post('/:id/cancel', optionalProtect, saleController.cancelSale);
router.post('/:id/return', optionalProtect, saleController.returnSale);
router.get('/:id/returns', optionalProtect, saleController.getSaleReturns);
router.delete('/returns/:returnId', optionalProtect, saleController.deleteSaleReturn);
router.delete('/:id/returns/:returnId', optionalProtect, saleController.deleteSaleReturn);
router.delete('/:id', optionalProtect, saleController.deleteSale);
router.post('/bulk-delete', optionalProtect, saleController.bulkDeleteSales);

module.exports = router;
