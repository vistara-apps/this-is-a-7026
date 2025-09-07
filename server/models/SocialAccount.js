import mongoose from 'mongoose';

const socialAccountSchema = new mongoose.Schema({
  accountId: {
    type: String,
    unique: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['twitter', 'linkedin', 'instagram', 'facebook']
  },
  platformUserId: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    default: null
  },
  tokenExpires: {
    type: Date,
    default: null
  },
  profileInfo: {
    username: { type: String, required: true },
    displayName: { type: String, required: true },
    profilePicture: { type: String, default: null },
    bio: { type: String, default: null },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 },
    verified: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSyncAt: {
    type: Date,
    default: Date.now
  },
  syncErrors: [{
    error: String,
    timestamp: { type: Date, default: Date.now }
  }],
  permissions: {
    canPost: { type: Boolean, default: false },
    canRead: { type: Boolean, default: false },
    canManage: { type: Boolean, default: false }
  },
  settings: {
    autoPost: { type: Boolean, default: true },
    notifications: { type: Boolean, default: true },
    analytics: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

// Compound index for user and platform uniqueness
socialAccountSchema.index({ userId: 1, platform: 1, platformUserId: 1 }, { unique: true });

// Check if token is expired
socialAccountSchema.methods.isTokenExpired = function() {
  if (!this.tokenExpires) return false;
  return new Date() > this.tokenExpires;
};

// Get platform-specific API limits
socialAccountSchema.methods.getApiLimits = function() {
  const limits = {
    twitter: {
      postsPerDay: 300,
      postsPerHour: 50,
      charactersPerPost: 280
    },
    linkedin: {
      postsPerDay: 100,
      postsPerHour: 20,
      charactersPerPost: 3000
    },
    instagram: {
      postsPerDay: 25,
      postsPerHour: 5,
      charactersPerPost: 2200
    },
    facebook: {
      postsPerDay: 200,
      postsPerHour: 25,
      charactersPerPost: 63206
    }
  };
  
  return limits[this.platform] || limits.twitter;
};

// Update profile info from platform
socialAccountSchema.methods.updateProfileInfo = function(profileData) {
  this.profileInfo = {
    ...this.profileInfo,
    ...profileData
  };
  this.lastSyncAt = new Date();
};

// Add sync error
socialAccountSchema.methods.addSyncError = function(error) {
  this.syncErrors.push({
    error: error.message || error,
    timestamp: new Date()
  });
  
  // Keep only last 10 errors
  if (this.syncErrors.length > 10) {
    this.syncErrors = this.syncErrors.slice(-10);
  }
};

// Check if account needs token refresh
socialAccountSchema.methods.needsTokenRefresh = function() {
  if (!this.tokenExpires) return false;
  
  // Refresh if token expires within 1 hour
  const oneHour = 60 * 60 * 1000;
  return (this.tokenExpires.getTime() - Date.now()) < oneHour;
};

// Get display name for UI
socialAccountSchema.virtual('displayName').get(function() {
  return this.profileInfo.displayName || this.profileInfo.username;
});

// Transform output (hide sensitive data)
socialAccountSchema.methods.toJSON = function() {
  const account = this.toObject();
  delete account.accessToken;
  delete account.refreshToken;
  return account;
};

const SocialAccount = mongoose.model('SocialAccount', socialAccountSchema);

export default SocialAccount;
