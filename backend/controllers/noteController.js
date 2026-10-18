const Note = require('../models/Note');
const { getTenantQuery, hasTenantAccess } = require('../utils/tenantHelper');

// GET /api/notes
exports.getNotes = async (req, res) => {
  try {
    const { search } = req.query;
    let query = getTenantQuery(req);

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    const notes = await Note.find(query).sort({ isPinned: -1, updatedAt: -1 });
    res.status(200).json(notes);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching notes', error: error.message });
  }
};

// POST /api/notes
exports.createNote = async (req, res) => {
  try {
    const { title, content, color, isPinned } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Note title is required.' });
    }

    const note = new Note({
      userId: req.user._id,
      title: title.trim(),
      content: content ? content.trim() : '',
      color: color || '#FFF8F0',
      isPinned: Boolean(isPinned)
    });

    const saved = await note.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating note', error: error.message });
  }
};

// PUT /api/notes/:id
exports.updateNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note || !hasTenantAccess(note, req)) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }

    const { title, content, color, isPinned } = req.body;
    if (title !== undefined) note.title = title.trim();
    if (content !== undefined) note.content = content.trim();
    if (color !== undefined) note.color = color;
    if (isPinned !== undefined) note.isPinned = Boolean(isPinned);

    const saved = await note.save();
    res.status(200).json(saved);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating note', error: error.message });
  }
};

// DELETE /api/notes/:id
exports.deleteNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note || !hasTenantAccess(note, req)) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }

    await Note.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Note deleted successfully', id: req.params.id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting note', error: error.message });
  }
};
