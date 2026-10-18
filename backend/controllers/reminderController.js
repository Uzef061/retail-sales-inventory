const Reminder = require('../models/Reminder');
const { getTenantQuery, hasTenantAccess } = require('../utils/tenantHelper');

// GET /api/reminders
exports.getReminders = async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = getTenantQuery(req);

    const now = new Date();

    if (status === 'completed') {
      query.isCompleted = true;
    } else if (status === 'upcoming') {
      query.isCompleted = false;
      query.dueDate = { $gte: now };
    } else if (status === 'overdue') {
      query.isCompleted = false;
      query.dueDate = { $lt: now };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { partyName: { $regex: search, $options: 'i' } }
      ];
    }

    const reminders = await Reminder.find(query).sort({ dueDate: 1, createdAt: -1 });
    res.status(200).json(reminders);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching reminders', error: error.message });
  }
};

// POST /api/reminders
exports.createReminder = async (req, res) => {
  try {
    const { title, description, dueDate, priority, partyName } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Reminder title is required.' });
    }
    if (!dueDate) {
      return res.status(400).json({ success: false, message: 'Due date is required.' });
    }

    const reminder = new Reminder({
      userId: req.user._id,
      title: title.trim(),
      description: description ? description.trim() : '',
      dueDate: new Date(dueDate),
      priority: (priority || 'MEDIUM').toUpperCase(),
      partyName: partyName ? partyName.trim() : '',
      isCompleted: false
    });

    const saved = await reminder.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating reminder', error: error.message });
  }
};

// PUT /api/reminders/:id
exports.updateReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder || !hasTenantAccess(reminder, req)) {
      return res.status(404).json({ success: false, message: 'Reminder not found.' });
    }

    const { title, description, dueDate, priority, partyName, isCompleted } = req.body;
    if (title !== undefined) reminder.title = title.trim();
    if (description !== undefined) reminder.description = description.trim();
    if (dueDate !== undefined) reminder.dueDate = new Date(dueDate);
    if (priority !== undefined) reminder.priority = priority.toUpperCase();
    if (partyName !== undefined) reminder.partyName = partyName.trim();
    if (isCompleted !== undefined) {
      reminder.isCompleted = Boolean(isCompleted);
      reminder.completedAt = reminder.isCompleted ? new Date() : null;
    }

    const saved = await reminder.save();
    res.status(200).json(saved);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating reminder', error: error.message });
  }
};

// PUT /api/reminders/:id/toggle
exports.toggleReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder || !hasTenantAccess(reminder, req)) {
      return res.status(404).json({ success: false, message: 'Reminder not found.' });
    }

    reminder.isCompleted = !reminder.isCompleted;
    reminder.completedAt = reminder.isCompleted ? new Date() : null;

    const saved = await reminder.save();
    res.status(200).json(saved);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error toggling reminder', error: error.message });
  }
};

// DELETE /api/reminders/:id
exports.deleteReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder || !hasTenantAccess(reminder, req)) {
      return res.status(404).json({ success: false, message: 'Reminder not found.' });
    }

    await Reminder.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Reminder deleted successfully', id: req.params.id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting reminder', error: error.message });
  }
};
