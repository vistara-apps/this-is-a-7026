import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  postId: {
    type: String,
    unique: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  mediaUrls: [{
    type: String,
    url: String,
    mediaType: {
      type: String,
      enum: ['image', 'video', 'gif']
    },
    altText: String
  }],
  hashtags: [String],
  mentions: [String],
  scheduledAt: {
    type: Date,
    default: null
  },
  postedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'posted', 'failed', 'cancelled'],
    default: 'draft'
  },
  platformSpecificData: [{
    platform: {
      type: String,
      enum: ['twitter', 'linkedin', 'instagram', 'facebook'],
      required: true
    },
    socialAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SocialAccount',
      required: true
    },
    platformPostId: {
      type: String,
      default: null
    },
    customContent: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'posted', 'failed'],
      default: 'pending'
    },
    error: {
      type: String,
      default: null
    },
    postedAt: {
      type: Date,
      default: null
    }
  }],
  performanceMetrics: {
    totalLikes: { type: Number, default: 0 },
    totalComments: { type: Number, default: 0 },
    totalShares: { type: Number, default: 0 },
    totalReach: { type: Number, default: 0 },
    totalImpressions: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 },
    clickThroughRate: { type: Number, default: 0 },
    platformMetrics: [{
      platform: String,
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      reach: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now }
    }]
  },
  aiSuggestions: {
    optimalTime: {
      type: Date,
      default: null
    },
    suggestedHashtags: [String],
    contentScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    improvementSuggestions: [String]
  },
  isTemplate: {
    type: Boolean,
    default: false
  },
  templateName: {
    type: String,
    default: null
  },
  category: {
    type: String,
    enum: ['promotional', 'educational', 'entertainment', 'news', 'personal', 'other'],
    default: 'other'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ scheduledAt: 1, status: 1 });
postSchema.index({ 'platformSpecificData.platform': 1, 'platformSpecificData.status': 1 });

// Calculate total engagement
postSchema.methods.calculateTotalEngagement = function() {
  const metrics = this.performanceMetrics;
  return metrics.totalLikes + metrics.totalComments + metrics.totalShares;
};

// Update performance metrics
postSchema.methods.updateMetrics = function(platformMetrics) {
  // Reset totals
  this.performanceMetrics.totalLikes = 0;
  this.performanceMetrics.totalComments = 0;
  this.performanceMetrics.totalShares = 0;
  this.performanceMetrics.totalReach = 0;
  this.performanceMetrics.totalImpressions = 0;

  // Update platform-specific metrics
  platformMetrics.forEach(metric => {
    const existingMetric = this.performanceMetrics.platformMetrics.find(
      pm => pm.platform === metric.platform
    );

    if (existingMetric) {
      Object.assign(existingMetric, metric);
      existingMetric.lastUpdated = new Date();
    } else {
      this.performanceMetrics.platformMetrics.push({
        ...metric,
        lastUpdated: new Date()
      });
    }

    // Add to totals
    this.performanceMetrics.totalLikes += metric.likes || 0;
    this.performanceMetrics.totalComments += metric.comments || 0;
    this.performanceMetrics.totalShares += metric.shares || 0;
    this.performanceMetrics.totalReach += metric.reach || 0;
    this.performanceMetrics.totalImpressions += metric.impressions || 0;
  });

  // Calculate engagement rate
  if (this.performanceMetrics.totalImpressions > 0) {
    const totalEngagement = this.calculateTotalEngagement();
    this.performanceMetrics.engagementRate = 
      (totalEngagement / this.performanceMetrics.totalImpressions) * 100;
  }
};

// Check if post is scheduled
postSchema.methods.isScheduled = function() {
  return this.status === 'scheduled' && this.scheduledAt && this.scheduledAt > new Date();
};

// Check if post is ready to be published
postSchema.methods.isReadyToPublish = function() {
  return this.status === 'scheduled' && this.scheduledAt && this.scheduledAt <= new Date();
};

// Get platforms this post will be published to
postSchema.methods.getTargetPlatforms = function() {
  return this.platformSpecificData.map(psd => psd.platform);
};

// Update platform status
postSchema.methods.updatePlatformStatus = function(platform, status, error = null, platformPostId = null) {
  const platformData = this.platformSpecificData.find(psd => psd.platform === platform);
  if (platformData) {
    platformData.status = status;
    platformData.error = error;
    if (platformPostId) {
      platformData.platformPostId = platformPostId;
    }
    if (status === 'posted') {
      platformData.postedAt = new Date();
    }
  }

  // Update overall post status
  const allPosted = this.platformSpecificData.every(psd => psd.status === 'posted');
  const anyFailed = this.platformSpecificData.some(psd => psd.status === 'failed');
  
  if (allPosted) {
    this.status = 'posted';
    this.postedAt = new Date();
  } else if (anyFailed && this.platformSpecificData.every(psd => psd.status !== 'pending')) {
    this.status = 'failed';
  }
};

// Get content for specific platform (custom or default)
postSchema.methods.getContentForPlatform = function(platform) {
  const platformData = this.platformSpecificData.find(psd => psd.platform === platform);
  return platformData?.customContent || this.content;
};

const Post = mongoose.model('Post', postSchema);

export default Post;
