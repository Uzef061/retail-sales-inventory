const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { optionalProtect } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, paymentController.getPayments);
router.get('/summary', optionalProtect, paymentController.getPaymentsSummary);
router.post('/', optionalProtect, paymentController.createPayment);
router.get('/:id', optionalProtect, paymentController.getPaymentById);
router.put('/:id', optionalProtect, paymentController.updatePayment);
router.delete('/:id', optionalProtect, paymentController.deletePayment);

module.exports = router;
