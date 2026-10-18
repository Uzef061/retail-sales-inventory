const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, paymentController.getPayments);
router.get('/summary', protect, paymentController.getPaymentsSummary);
router.post('/', protect, paymentController.createPayment);
router.get('/:id', protect, paymentController.getPaymentById);
router.put('/:id', protect, paymentController.updatePayment);
router.delete('/:id', protect, paymentController.deletePayment);

module.exports = router;
