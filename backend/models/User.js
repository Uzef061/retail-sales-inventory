const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, sparse: true, trim: true },
    email: { type: String, sparse: true, trim: true, lowercase: true },
    googleId: { type: String, sparse: true, trim: true },
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      }
    },
    name: { type: String, default: 'Store Admin', trim: true },
    avatar: { type: String, default: '' },
    role: {
      type: String,
      enum: ['ADMIN', 'CASHIER'],
      default: 'ADMIN'
    },
    isActive: { type: Boolean, default: true },
    hasCompletedOnboarding: { type: Boolean, default: false },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProfile' }
  },
  { timestamps: true }
);

// Hash password before save if modified
userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next();
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
  if (!this.password) return false;
  // Support legacy plain text fallback for backward compatibility
  if (this.password === enteredPassword) return true;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
