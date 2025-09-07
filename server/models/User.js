import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  avatar: {
    type: String,
    default: null
  },
  subscriptionPlan: {
    type: String,
    enum: ['starter', 'pro', 'business'],
    default: 'starter'
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'past_due'],
    default: 'active'
  },
  stripeCustomerId: {
    type: String,
    default: null
  },
  subscriptionEndDate: {
    type: Date,
    default: null
  },
  connectedAccounts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SocialAccount'
  }],
  preferences: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      comments: { type: Boolean, default: true }
    },
    aiSuggestions: {
      type: Boolean,
      default: true
    }
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Get full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Get subscription limits
userSchema.methods.getSubscriptionLimits = function() {
  const limits = {
    starter: {
      accounts: 3,
      postsPerMonth: 50,
      aiSuggestions: 10
    },
    pro: {
      accounts: 10,
      postsPerMonth: 200,
      aiSuggestions: 100
    },
    business: {
      accounts: -1, // unlimited
      postsPerMonth: -1, // unlimited
      aiSuggestions: -1 // unlimited
    }
  };
  
  return limits[this.subscriptionPlan] || limits.starter;
};

// Check if user can connect more accounts
userSchema.methods.canConnectMoreAccounts = function() {
  const limits = this.getSubscriptionLimits();
  if (limits.accounts === -1) return true;
  return this.connectedAccounts.length < limits.accounts;
};

// Transform output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.emailVerificationToken;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  return user;
};

const User = mongoose.model('User', userSchema);

export default User;
