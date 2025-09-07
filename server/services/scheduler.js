import cron from 'node-cron';
import Post from '../models/Post.js';
import SocialAccount from '../models/SocialAccount.js';

// Schedule to run every minute to check for posts ready to publish
cron.schedule('* * * * *', async () => {
  try {
    console.log('🔄 Checking for scheduled posts...');
    
    // Find posts that are scheduled and ready to be published
    const readyPosts = await Post.find({
      status: 'scheduled',
      scheduledAt: { $lte: new Date() }
    }).populate('platformSpecificData.socialAccountId');

    if (readyPosts.length === 0) {
      return;
    }

    console.log(`📝 Found ${readyPosts.length} posts ready to publish`);

    for (const post of readyPosts) {
      try {
        await publishPost(post);
        console.log(`✅ Published post ${post._id}`);
      } catch (error) {
        console.error(`❌ Failed to publish post ${post._id}:`, error);
        
        // Mark post as failed
        post.status = 'failed';
        await post.save();
      }
    }

  } catch (error) {
    console.error('❌ Scheduler error:', error);
  }
});

// Schedule to run every hour to refresh social account data
cron.schedule('0 * * * *', async () => {
  try {
    console.log('🔄 Refreshing social account data...');
    
    // Find accounts that need token refresh
    const accountsToRefresh = await SocialAccount.find({
      isActive: true,
      $or: [
        { lastSyncAt: { $lt: new Date(Date.now() - 6 * 60 * 60 * 1000) } }, // 6 hours ago
        { tokenExpires: { $lt: new Date(Date.now() + 60 * 60 * 1000) } } // Expires in 1 hour
      ]
    });

    console.log(`🔄 Refreshing ${accountsToRefresh.length} social accounts`);

    for (const account of accountsToRefresh) {
      try {
        await refreshAccountData(account);
        console.log(`✅ Refreshed account ${account._id} (${account.platform})`);
      } catch (error) {
        console.error(`❌ Failed to refresh account ${account._id}:`, error);
        
        // Log sync error
        account.addSyncError(error);
        await account.save();
      }
    }

  } catch (error) {
    console.error('❌ Account refresh scheduler error:', error);
  }
});

// Schedule to run daily at midnight to clean up old data
cron.schedule('0 0 * * *', async () => {
  try {
    console.log('🧹 Running daily cleanup...');
    
    // Clean up old sync errors (keep only last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    await SocialAccount.updateMany(
      {},
      {
        $pull: {
          syncErrors: {
            timestamp: { $lt: thirtyDaysAgo }
          }
        }
      }
    );

    // Clean up old draft posts (older than 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    const deletedDrafts = await Post.deleteMany({
      status: 'draft',
      createdAt: { $lt: ninetyDaysAgo }
    });

    console.log(`🧹 Cleanup completed: removed ${deletedDrafts.deletedCount} old drafts`);

  } catch (error) {
    console.error('❌ Cleanup scheduler error:', error);
  }
});

// Function to publish a post to social platforms
async function publishPost(post) {
  const results = [];
  
  for (const platformData of post.platformSpecificData) {
    try {
      const account = platformData.socialAccountId;
      if (!account || !account.isActive) {
        throw new Error(`Account not found or inactive for ${platformData.platform}`);
      }

      // Get content for this platform
      const content = post.getContentForPlatform(platformData.platform);
      
      // Publish to platform
      const result = await publishToPlatform(
        platformData.platform,
        account,
        content,
        post.mediaUrls,
        post.hashtags
      );

      // Update platform status
      post.updatePlatformStatus(
        platformData.platform,
        'posted',
        null,
        result.platformPostId
      );

      results.push({
        platform: platformData.platform,
        success: true,
        platformPostId: result.platformPostId
      });

    } catch (error) {
      console.error(`Failed to publish to ${platformData.platform}:`, error);
      
      // Update platform status with error
      post.updatePlatformStatus(
        platformData.platform,
        'failed',
        error.message
      );

      results.push({
        platform: platformData.platform,
        success: false,
        error: error.message
      });
    }
  }

  // Save post with updated statuses
  await post.save();

  return results;
}

// Function to publish content to a specific platform
async function publishToPlatform(platform, account, content, mediaUrls = [], hashtags = []) {
  // This would implement actual API calls to social platforms
  // For now, return mock data
  
  console.log(`📤 Publishing to ${platform}:`, {
    content: content.substring(0, 50) + '...',
    mediaCount: mediaUrls.length,
    hashtagCount: hashtags.length
  });

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Mock successful response
  return {
    platformPostId: `${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    url: `https://${platform}.com/post/mock_${Date.now()}`,
    publishedAt: new Date()
  };
}

// Function to refresh social account data
async function refreshAccountData(account) {
  // This would implement actual API calls to refresh account data
  // For now, just update the lastSyncAt timestamp
  
  console.log(`🔄 Refreshing ${account.platform} account data for ${account.profileInfo.username}`);

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));

  // Mock updated profile data
  const updatedData = {
    followersCount: account.profileInfo.followersCount + Math.floor(Math.random() * 10),
    followingCount: account.profileInfo.followingCount + Math.floor(Math.random() * 5),
    postsCount: account.profileInfo.postsCount + Math.floor(Math.random() * 3)
  };

  account.updateProfileInfo(updatedData);
  await account.save();

  return updatedData;
}

console.log('📅 Scheduler initialized with the following jobs:');
console.log('  - Post publishing: Every minute');
console.log('  - Account refresh: Every hour');
console.log('  - Data cleanup: Daily at midnight');

export default {
  publishPost,
  refreshAccountData
};
