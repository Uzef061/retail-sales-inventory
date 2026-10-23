const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');

// Read operations
router.get('/', optionalProtect, paymentController.getPayments);
router.get('/summary', optionalProtect, paymentController.getPaymentsSummary);
router.get('/:id', optionalProtect, paymentController.getPaymentById);

// Mutation operations strictly require authentication
router.post('/', protect, paymentController.createPayment);
router.put('/:id', protect, paymentController.updatePayment);
router.delete('/:id', protect, paymentController.deletePayment);

module.exports = router;
