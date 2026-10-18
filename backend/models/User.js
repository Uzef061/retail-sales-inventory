const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, default: 'Store Admin', trim: true },
    role: {
      type: String,
      enum: ['ADMIN', 'CASHIER'],
      default: 'ADMIN'
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Hash password before save if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare entered password with hashed password in DB
userSchema.methods.matchPassword = async function (enteredPassword) {
  // Support legacy plain text fallback for backward compatibility
  if (this.password === enteredPassword) return true;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
