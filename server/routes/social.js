import express from 'express';
import SocialAccount from '../models/SocialAccount.js';
import { checkUsageLimit } from '../middleware/auth.js';

const router = express.Router();

// Get all connected social accounts
router.get('/accounts', async (req, res) => {
  try {
    const userId = req.user._id;
    
    const accounts = await SocialAccount.find({ userId, isActive: true })
      .select('-accessToken -refreshToken')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      accounts,
      message: 'Social accounts retrieved successfully'
    });

  } catch (error) {
    console.error('Get social accounts error:', error);
    res.status(500).json({
      error: 'Failed to retrieve social accounts',
      code: 'SOCIAL_ACCOUNTS_ERROR'
    });
  }
});

// Connect a new social account (OAuth initiation)
router.post('/connect/:platform', checkUsageLimit('accounts'), async (req, res) => {
  try {
    const { platform } = req.params;
    const userId = req.user._id;

    if (!['twitter', 'linkedin', 'instagram', 'facebook'].includes(platform)) {
      return res.status(400).json({
        error: 'Invalid platform',
        code: 'INVALID_PLATFORM'
      });
    }

    // Check if user can connect more accounts
    if (!req.user.canConnectMoreAccounts()) {
      return res.status(403).json({
        error: 'Account connection limit reached',
        code: 'ACCOUNT_LIMIT_REACHED'
      });
    }

    // Generate OAuth URL based on platform
    const oauthUrl = generateOAuthUrl(platform, userId);

    res.json({
      success: true,
      oauthUrl,
      message: `OAuth URL generated for ${platform}`
    });

  } catch (error) {
    console.error('Connect social account error:', error);
    res.status(500).json({
      error: 'Failed to initiate social account connection',
      code: 'SOCIAL_CONNECT_ERROR'
    });
  }
});

// OAuth callback handler
router.get('/callback/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({
        error: 'Authorization code is required',
        code: 'MISSING_AUTH_CODE'
      });
    }

    // Exchange code for access token and create social account
    const accountData = await exchangeCodeForToken(platform, code);
    
    // Save social account to database
    const socialAccount = new SocialAccount({
      userId: state, // userId passed as state parameter
      platform,
      platformUserId: accountData.id,
      accessToken: accountData.access_token,
      refreshToken: accountData.refresh_token,
      tokenExpires: accountData.expires_at ? new Date(accountData.expires_at * 1000) : null,
      profileInfo: {
        username: accountData.username,
        displayName: accountData.name,
        profilePicture: accountData.profile_image_url,
        bio: accountData.description,
        followersCount: accountData.public_metrics?.followers_count || 0,
        followingCount: accountData.public_metrics?.following_count || 0,
        postsCount: accountData.public_metrics?.tweet_count || 0,
        verified: accountData.verified || false
      },
      permissions: {
        canPost: true,
        canRead: true,
        canManage: false
      }
    });

    await socialAccount.save();

    // Update user's connected accounts
    await req.user.updateOne({
      $push: { connectedAccounts: socialAccount._id }
    });

    res.json({
      success: true,
      account: socialAccount.toJSON(),
      message: `${platform} account connected successfully`
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      error: 'Failed to complete social account connection',
      code: 'OAUTH_CALLBACK_ERROR'
    });
  }
});

// Disconnect a social account
router.delete('/accounts/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user._id;

    const account = await SocialAccount.findOne({ _id: accountId, userId });
    if (!account) {
      return res.status(404).json({
        error: 'Social account not found',
        code: 'ACCOUNT_NOT_FOUND'
      });
    }

    // Deactivate account instead of deleting (to preserve historical data)
    account.isActive = false;
    await account.save();

    // Remove from user's connected accounts
    await req.user.updateOne({
      $pull: { connectedAccounts: accountId }
    });

    res.json({
      success: true,
      message: 'Social account disconnected successfully'
    });

  } catch (error) {
    console.error('Disconnect social account error:', error);
    res.status(500).json({
      error: 'Failed to disconnect social account',
      code: 'SOCIAL_DISCONNECT_ERROR'
    });
  }
});

// Refresh account data
router.post('/accounts/:accountId/refresh', async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user._id;

    const account = await SocialAccount.findOne({ _id: accountId, userId, isActive: true });
    if (!account) {
      return res.status(404).json({
        error: 'Social account not found',
        code: 'ACCOUNT_NOT_FOUND'
      });
    }

    // Refresh profile data from platform
    const updatedProfileData = await fetchProfileData(account.platform, account.accessToken);
    account.updateProfileInfo(updatedProfileData);
    await account.save();

    res.json({
      success: true,
      account: account.toJSON(),
      message: 'Account data refreshed successfully'
    });

  } catch (error) {
    console.error('Refresh account data error:', error);
    res.status(500).json({
      error: 'Failed to refresh account data',
      code: 'ACCOUNT_REFRESH_ERROR'
    });
  }
});

// Helper functions (these would be implemented with actual OAuth logic)
function generateOAuthUrl(platform, userId) {
  const baseUrls = {
    twitter: 'https://twitter.com/i/oauth2/authorize',
    linkedin: 'https://www.linkedin.com/oauth/v2/authorization',
    facebook: 'https://www.facebook.com/v18.0/dialog/oauth',
    instagram: 'https://api.instagram.com/oauth/authorize'
  };

  const clientIds = {
    twitter: process.env.TWITTER_CLIENT_ID,
    linkedin: process.env.LINKEDIN_CLIENT_ID,
    facebook: process.env.FACEBOOK_APP_ID,
    instagram: process.env.INSTAGRAM_CLIENT_ID
  };

  const scopes = {
    twitter: 'tweet.read tweet.write users.read offline.access',
    linkedin: 'r_liteprofile r_emailaddress w_member_social',
    facebook: 'pages_manage_posts pages_read_engagement',
    instagram: 'user_profile user_media'
  };

  const redirectUri = `${process.env.CLIENT_URL}/api/social/callback/${platform}`;

  return `${baseUrls[platform]}?client_id=${clientIds[platform]}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes[platform])}&response_type=code&state=${userId}`;
}

async function exchangeCodeForToken(platform, code) {
  // This would implement the actual OAuth token exchange
  // For now, return mock data
  return {
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    id: 'mock_user_id',
    username: 'mock_username',
    name: 'Mock User',
    profile_image_url: 'https://example.com/avatar.jpg',
    description: 'Mock user bio',
    verified: false,
    public_metrics: {
      followers_count: 100,
      following_count: 50,
      tweet_count: 25
    }
  };
}

async function fetchProfileData(platform, accessToken) {
  // This would implement actual API calls to fetch profile data
  // For now, return mock data
  return {
    username: 'updated_username',
    displayName: 'Updated User',
    followersCount: 105,
    followingCount: 52,
    postsCount: 27
  };
}

export default router;
