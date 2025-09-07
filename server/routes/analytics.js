import express from 'express';
import Post from '../models/Post.js';
import Engagement from '../models/Engagement.js';
import SocialAccount from '../models/SocialAccount.js';

const router = express.Router();

// Get dashboard analytics
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeRange = '7d' } = req.query;
    
    const days = parseInt(timeRange.replace('d', ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get posts in time range
    const posts = await Post.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    });

    // Calculate metrics
    const totalPosts = posts.length;
    const totalEngagement = posts.reduce((sum, post) => sum + post.calculateTotalEngagement(), 0);
    const totalReach = posts.reduce((sum, post) => sum + (post.performanceMetrics.totalReach || 0), 0);
    const totalImpressions = posts.reduce((sum, post) => sum + (post.performanceMetrics.totalImpressions || 0), 0);
    
    const avgEngagementRate = totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0;

    // Get platform breakdown
    const platformMetrics = {};
    posts.forEach(post => {
      post.performanceMetrics.platformMetrics.forEach(pm => {
        if (!platformMetrics[pm.platform]) {
          platformMetrics[pm.platform] = {
            posts: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            reach: 0,
            impressions: 0
          };
        }
        platformMetrics[pm.platform].posts += 1;
        platformMetrics[pm.platform].likes += pm.likes || 0;
        platformMetrics[pm.platform].comments += pm.comments || 0;
        platformMetrics[pm.platform].shares += pm.shares || 0;
        platformMetrics[pm.platform].reach += pm.reach || 0;
        platformMetrics[pm.platform].impressions += pm.impressions || 0;
      });
    });

    // Get top performing posts
    const topPosts = posts
      .sort((a, b) => b.performanceMetrics.engagementRate - a.performanceMetrics.engagementRate)
      .slice(0, 5)
      .map(post => ({
        id: post._id,
        content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
        engagementRate: post.performanceMetrics.engagementRate,
        totalEngagement: post.calculateTotalEngagement(),
        postedAt: post.postedAt,
        platforms: post.getTargetPlatforms()
      }));

    res.json({
      success: true,
      analytics: {
        overview: {
          totalPosts,
          totalEngagement,
          totalReach,
          totalImpressions,
          avgEngagementRate: Math.round(avgEngagementRate * 100) / 100
        },
        platformMetrics,
        topPosts,
        timeRange,
        period: {
          start: startDate,
          end: new Date()
        }
      }
    });

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve dashboard analytics',
      code: 'ANALYTICS_DASHBOARD_ERROR'
    });
  }
});

// Get engagement analytics
router.get('/engagement', async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeRange = '30d', platform } = req.query;
    
    const days = parseInt(timeRange.replace('d', ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user's social accounts
    const accounts = await SocialAccount.find({ userId, isActive: true });
    const accountIds = accounts.map(acc => acc._id);

    // Build engagement filter
    const engagementFilter = {
      socialAccountId: { $in: accountIds },
      timestamp: { $gte: startDate }
    };
    
    if (platform) {
      engagementFilter.platform = platform;
    }

    // Get engagements
    const engagements = await Engagement.find(engagementFilter)
      .sort({ timestamp: -1 });

    // Group by type and date
    const engagementByType = {};
    const engagementByDate = {};
    
    engagements.forEach(engagement => {
      const type = engagement.type;
      const date = engagement.timestamp.toISOString().split('T')[0];
      
      // By type
      if (!engagementByType[type]) {
        engagementByType[type] = 0;
      }
      engagementByType[type]++;
      
      // By date
      if (!engagementByDate[date]) {
        engagementByDate[date] = {
          likes: 0,
          comments: 0,
          shares: 0,
          mentions: 0,
          total: 0
        };
      }
      engagementByDate[date][type] = (engagementByDate[date][type] || 0) + 1;
      engagementByDate[date].total++;
    });

    // Get unread count
    const unreadCount = await Engagement.countDocuments({
      ...engagementFilter,
      isRead: false
    });

    // Get recent engagements
    const recentEngagements = engagements.slice(0, 10).map(engagement => ({
      id: engagement._id,
      type: engagement.type,
      platform: engagement.platform,
      author: engagement.author,
      content: engagement.content,
      timestamp: engagement.timestamp,
      isRead: engagement.isRead,
      priority: engagement.priority
    }));

    res.json({
      success: true,
      engagement: {
        summary: {
          total: engagements.length,
          unread: unreadCount,
          byType: engagementByType
        },
        timeline: engagementByDate,
        recent: recentEngagements,
        timeRange,
        platform: platform || 'all'
      }
    });

  } catch (error) {
    console.error('Engagement analytics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve engagement analytics',
      code: 'ANALYTICS_ENGAGEMENT_ERROR'
    });
  }
});

// Get performance trends
router.get('/trends', async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeRange = '30d', metric = 'engagement' } = req.query;
    
    const days = parseInt(timeRange.replace('d', ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get posts with performance data
    const posts = await Post.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    }).sort({ postedAt: 1 });

    // Group by date and calculate trends
    const trendData = {};
    
    posts.forEach(post => {
      const date = post.postedAt.toISOString().split('T')[0];
      
      if (!trendData[date]) {
        trendData[date] = {
          posts: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          totalReach: 0,
          totalImpressions: 0,
          totalEngagement: 0
        };
      }
      
      trendData[date].posts++;
      trendData[date].totalLikes += post.performanceMetrics.totalLikes || 0;
      trendData[date].totalComments += post.performanceMetrics.totalComments || 0;
      trendData[date].totalShares += post.performanceMetrics.totalShares || 0;
      trendData[date].totalReach += post.performanceMetrics.totalReach || 0;
      trendData[date].totalImpressions += post.performanceMetrics.totalImpressions || 0;
      trendData[date].totalEngagement += post.calculateTotalEngagement();
    });

    // Calculate percentage changes
    const dates = Object.keys(trendData).sort();
    const trends = dates.map((date, index) => {
      const current = trendData[date];
      const previous = index > 0 ? trendData[dates[index - 1]] : null;
      
      let change = 0;
      if (previous && previous[`total${metric.charAt(0).toUpperCase() + metric.slice(1)}`] > 0) {
        const currentValue = current[`total${metric.charAt(0).toUpperCase() + metric.slice(1)}`] || current.totalEngagement;
        const previousValue = previous[`total${metric.charAt(0).toUpperCase() + metric.slice(1)}`] || previous.totalEngagement;
        change = ((currentValue - previousValue) / previousValue) * 100;
      }
      
      return {
        date,
        value: current[`total${metric.charAt(0).toUpperCase() + metric.slice(1)}`] || current.totalEngagement,
        change: Math.round(change * 100) / 100,
        posts: current.posts
      };
    });

    res.json({
      success: true,
      trends: {
        data: trends,
        metric,
        timeRange,
        summary: {
          totalDataPoints: trends.length,
          avgValue: trends.length > 0 ? trends.reduce((sum, t) => sum + t.value, 0) / trends.length : 0,
          bestDay: trends.length > 0 ? trends.reduce((best, current) => current.value > best.value ? current : best) : null,
          worstDay: trends.length > 0 ? trends.reduce((worst, current) => current.value < worst.value ? current : worst) : null
        }
      }
    });

  } catch (error) {
    console.error('Trends analytics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve trend analytics',
      code: 'ANALYTICS_TRENDS_ERROR'
    });
  }
});

// Get platform comparison
router.get('/platforms', async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeRange = '30d' } = req.query;
    
    const days = parseInt(timeRange.replace('d', ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get posts by platform
    const posts = await Post.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    });

    const platformComparison = {};
    
    posts.forEach(post => {
      post.performanceMetrics.platformMetrics.forEach(pm => {
        if (!platformComparison[pm.platform]) {
          platformComparison[pm.platform] = {
            posts: 0,
            totalLikes: 0,
            totalComments: 0,
            totalShares: 0,
            totalReach: 0,
            totalImpressions: 0,
            avgEngagementRate: 0
          };
        }
        
        const platform = platformComparison[pm.platform];
        platform.posts++;
        platform.totalLikes += pm.likes || 0;
        platform.totalComments += pm.comments || 0;
        platform.totalShares += pm.shares || 0;
        platform.totalReach += pm.reach || 0;
        platform.totalImpressions += pm.impressions || 0;
      });
    });

    // Calculate averages and engagement rates
    Object.keys(platformComparison).forEach(platform => {
      const data = platformComparison[platform];
      if (data.posts > 0) {
        data.avgLikes = Math.round(data.totalLikes / data.posts);
        data.avgComments = Math.round(data.totalComments / data.posts);
        data.avgShares = Math.round(data.totalShares / data.posts);
        data.avgReach = Math.round(data.totalReach / data.posts);
        data.avgImpressions = Math.round(data.totalImpressions / data.posts);
        
        if (data.totalImpressions > 0) {
          const totalEngagement = data.totalLikes + data.totalComments + data.totalShares;
          data.avgEngagementRate = Math.round((totalEngagement / data.totalImpressions) * 10000) / 100;
        }
      }
    });

    res.json({
      success: true,
      platformComparison,
      timeRange
    });

  } catch (error) {
    console.error('Platform comparison error:', error);
    res.status(500).json({
      error: 'Failed to retrieve platform comparison',
      code: 'ANALYTICS_PLATFORMS_ERROR'
    });
  }
});

export default router;
