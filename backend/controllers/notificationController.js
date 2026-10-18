const Notification = require('../models/Notification');
const Product = require('../models/Product');
const Reminder = require('../models/Reminder');
const { getTenantQuery, hasTenantAccess } = require('../utils/tenantHelper');

// GET /api/notifications
exports.getNotifications = async (req, res) => {
  try {
    const query = getTenantQuery(req);

    // Sync automatic alerts (low stock, upcoming/overdue reminders)
    await syncAlertsForUser(req.user._id);

    const notifications = await Notification.find(query).sort({ timestamp: -1, createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ ...query, isRead: false });

    res.status(200).json({
      success: true,
      unreadCount,
      notifications
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching notifications', error: error.message });
  }
};

// PUT /api/notifications/:id/read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification || !hasTenantAccess(notification, req)) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating notification', error: error.message });
  }
};

// PUT /api/notifications/read-all
exports.markAllAsRead = async (req, res) => {
  try {
    const query = getTenantQuery(req, { isRead: false });
    await Notification.updateMany(query, { isRead: true });

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error marking all notifications as read', error: error.message });
  }
};

// DELETE /api/notifications/:id
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification || !hasTenantAccess(notification, req)) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    await Notification.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Notification deleted successfully', id: req.params.id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting notification', error: error.message });
  }
};

// Helper: Sync automatic contextual alerts for tenant without creating duplicates
const syncAlertsForUser = async (userId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Check Low Stock Items
    const lowStockProducts = await Product.find({
      userId,
      isActive: true,
      $expr: { $lte: ['$stock', '$reorderLevel'] }
    });

    for (const prod of lowStockProducts) {
      const existingAlert = await Notification.findOne({
        userId,
        type: 'LOW_STOCK',
        relatedId: prod._id.toString(),
        timestamp: { $gte: today }
      });

      if (!existingAlert) {
        await Notification.create({
          userId,
          title: `Low Stock Alert: ${prod.name}`,
          message: `Only ${prod.stock} units left in stock. Reorder level is ${prod.reorderLevel}.`,
          type: 'LOW_STOCK',
          relatedId: prod._id.toString(),
          timestamp: new Date()
        });
      }
    }

    // 2. Check Overdue & Today's Reminders
    const now = new Date();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const pendingReminders = await Reminder.find({
      userId,
      isCompleted: false,
      dueDate: { $lte: endOfToday }
    });

    for (const rem of pendingReminders) {
      const isOverdue = new Date(rem.dueDate) < now;
      const alertType = isOverdue ? 'REMINDER' : 'REMINDER';
      const existingReminderAlert = await Notification.findOne({
        userId,
        type: 'REMINDER',
        relatedId: rem._id.toString(),
        timestamp: { $gte: today }
      });

      if (!existingReminderAlert) {
        await Notification.create({
          userId,
          title: isOverdue ? `Overdue Reminder: ${rem.title}` : `Reminder Due Today: ${rem.title}`,
          message: rem.description || `Reminder scheduled for ${new Date(rem.dueDate).toLocaleDateString()}.`,
          type: 'REMINDER',
          relatedId: rem._id.toString(),
          timestamp: new Date()
        });
      }
    }
  } catch (err) {
    // Fail silently in background sync to prevent blocking notification fetch
    console.error('Error syncing user alerts:', err.message);
  }
};
