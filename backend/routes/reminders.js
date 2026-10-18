const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, reminderController.getReminders);
router.post('/', protect, reminderController.createReminder);
router.put('/:id', protect, reminderController.updateReminder);
router.put('/:id/toggle', protect, reminderController.toggleReminder);
router.delete('/:id', protect, reminderController.deleteReminder);

module.exports = router;
