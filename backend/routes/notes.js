const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, noteController.getNotes);
router.post('/', protect, noteController.createNote);
router.put('/:id', protect, noteController.updateNote);
router.delete('/:id', protect, noteController.deleteNote);

module.exports = router;
