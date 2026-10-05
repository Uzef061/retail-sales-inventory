const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');

router.get('/', saleController.getSales);
router.post('/', saleController.createSale);
router.post('/bulk-delete', saleController.bulkDeleteSales);
router.delete('/:id', saleController.deleteSale);

module.exports = router;
