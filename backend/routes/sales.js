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
router.delete('/:id', protect, authorize('ADMIN'), saleController.deleteSale);
router.post('/bulk-delete', protect, authorize('ADMIN'), saleController.bulkDeleteSales);

module.exports = router;
