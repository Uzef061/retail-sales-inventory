const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { optionalProtect, protect, authorize } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, customerController.getCustomers);
router.get('/:id/sales', optionalProtect, customerController.getCustomerHistory);
router.post('/', protect, authorize('ADMIN', 'CASHIER'), customerController.createCustomer);
router.put('/:id', protect, authorize('ADMIN', 'CASHIER'), customerController.updateCustomer);
router.delete('/:id', protect, authorize('ADMIN'), customerController.deleteCustomer);

module.exports = router;
