const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  lastLoginAt: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Subscription and usage
  subscriptionPlan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free'
  },
  apiUsage: {
    totalRequests: { type: Number, default: 0 },
    monthlyRequests: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: Date.now }
  },
  
  // Preferences
  preferences: {
    defaultModel: String,
    defaultQuality: String,
    notifications: {
      email: { type: Boolean, default: true },
      clipComplete: { type: Boolean, default: true }
    }
  }
}, { 
  timestamps: true 
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
UserSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.emailVerificationToken;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  return user;
};

// Update API usage
UserSchema.methods.incrementApiUsage = function() {
  const now = new Date();
  const lastReset = this.apiUsage.lastResetDate;
  
  // Reset monthly count if it's a new month
  if (now.getMonth() !== lastReset.getMonth() || 
      now.getFullYear() !== lastReset.getFullYear()) {
    this.apiUsage.monthlyRequests = 0;
    this.apiUsage.lastResetDate = now;
  }
  
  this.apiUsage.totalRequests += 1;
  this.apiUsage.monthlyRequests += 1;
  
  return this.save();
};

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ emailVerificationToken: 1 });
UserSchema.index({ passwordResetToken: 1 });

module.exports = mongoose.model('User', UserSchema);
