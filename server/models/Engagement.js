import mongoose from 'mongoose';

const engagementSchema = new mongoose.Schema({
  engagementId: {
    type: String,
    unique: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  socialAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SocialAccount',
    required: true
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'instagram', 'facebook'],
    required: true
  },
  type: {
    type: String,
    enum: ['like', 'comment', 'share', 'mention', 'reply', 'dm', 'follow', 'unfollow'],
    required: true
  },
  platformEngagementId: {
    type: String,
    required: true
  },
  author: {
    platformUserId: { type: String, required: true },
    username: { type: String, required: true },
    displayName: { type: String, required: true },
    profilePicture: { type: String, default: null },
    verified: { type: Boolean, default: false },
    followersCount: { type: Number, default: 0 }
  },
  content: {
    type: String,
    default: null
  },
  parentEngagementId: {
    type: String,
    default: null // For replies to comments
  },
  metadata: {
    sentiment: {
      type: String,
      enum: ['positive', 'negative', 'neutral'],
      default: 'neutral'
    },
    language: {
      type: String,
      default: 'en'
    },
    location: {
      type: String,
      default: null
    },
    deviceType: {
      type: String,
      enum: ['mobile', 'desktop', 'tablet'],
      default: null
    }
  },
  timestamp: {
    type: Date,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isSpam: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  tags: [String],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  response: {
    content: { type: String, default: null },
    respondedAt: { type: Date, default: null },
    respondedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      default: null 
    },
    platformResponseId: { type: String, default: null }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
engagementSchema.index({ socialAccountId: 1, timestamp: -1 });
engagementSchema.index({ postId: 1, type: 1 });
engagementSchema.index({ platform: 1, type: 1, timestamp: -1 });
engagementSchema.index({ isRead: 1, timestamp: -1 });
engagementSchema.index({ platformEngagementId: 1, platform: 1 }, { unique: true });

// Mark as read
engagementSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

// Mark as unread
engagementSchema.methods.markAsUnread = function() {
  this.isRead = false;
  return this.save();
};

// Archive engagement
engagementSchema.methods.archive = function() {
  this.isArchived = true;
  return this.save();
};

// Unarchive engagement
engagementSchema.methods.unarchive = function() {
  this.isArchived = false;
  return this.save();
};

// Mark as spam
engagementSchema.methods.markAsSpam = function() {
  this.isSpam = true;
  this.isArchived = true;
  return this.save();
};

// Add response
engagementSchema.methods.addResponse = function(content, userId, platformResponseId = null) {
  this.response = {
    content,
    respondedAt: new Date(),
    respondedBy: userId,
    platformResponseId
  };
  this.isRead = true;
  return this.save();
};

// Check if engagement needs attention
engagementSchema.methods.needsAttention = function() {
  if (this.isArchived || this.isSpam) return false;
  
  // High priority items always need attention
  if (this.priority === 'high' || this.priority === 'urgent') return true;
  
  // Unread mentions and DMs need attention
  if (!this.isRead && (this.type === 'mention' || this.type === 'dm')) return true;
  
  // Comments from verified users need attention
  if (!this.isRead && this.type === 'comment' && this.author.verified) return true;
  
  return false;
};

// Get engagement age in hours
engagementSchema.methods.getAgeInHours = function() {
  return Math.floor((Date.now() - this.timestamp.getTime()) / (1000 * 60 * 60));
};

// Auto-assign priority based on engagement type and author
engagementSchema.methods.calculatePriority = function() {
  // Urgent: DMs from verified users or high-follower accounts
  if (this.type === 'dm' && (this.author.verified || this.author.followersCount > 10000)) {
    this.priority = 'urgent';
  }
  // High: Mentions from verified users or negative sentiment
  else if ((this.type === 'mention' && this.author.verified) || this.metadata.sentiment === 'negative') {
    this.priority = 'high';
  }
  // Medium: Comments and regular mentions
  else if (this.type === 'comment' || this.type === 'mention') {
    this.priority = 'medium';
  }
  // Low: Likes, shares, follows
  else {
    this.priority = 'low';
  }
  
  return this.priority;
};

// Static method to get engagement stats for a user
engagementSchema.statics.getEngagementStats = async function(userId, timeRange = '7d') {
  const days = parseInt(timeRange.replace('d', ''));
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const pipeline = [
    {
      $lookup: {
        from: 'socialaccounts',
        localField: 'socialAccountId',
        foreignField: '_id',
        as: 'account'
      }
    },
    {
      $match: {
        'account.userId': new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          type: '$type',
          platform: '$platform'
        },
        count: { $sum: 1 },
        unreadCount: {
          $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
        }
      }
    }
  ];

  return this.aggregate(pipeline);
};

// Virtual for formatted timestamp
engagementSchema.virtual('formattedTimestamp').get(function() {
  const now = new Date();
  const diff = now - this.timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return this.timestamp.toLocaleDateString();
});

const Engagement = mongoose.model('Engagement', engagementSchema);

export default Engagement;
