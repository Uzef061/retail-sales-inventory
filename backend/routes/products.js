const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { optionalProtect, protect, authorize } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, productController.getProducts);
router.post('/', protect, authorize('ADMIN'), productController.createProduct);
router.put('/:id', protect, authorize('ADMIN'), productController.updateProduct);
router.delete('/:id', protect, authorize('ADMIN'), productController.deleteProduct);
router.post('/bulk-delete', protect, authorize('ADMIN'), productController.bulkDeleteProducts);

module.exports = router;
