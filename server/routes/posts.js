import express from 'express';
import Post from '../models/Post.js';
import { checkUsageLimit } from '../middleware/auth.js';

const router = express.Router();

// Get all posts for user
router.get('/', async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, platform, limit = 20, page = 1 } = req.query;

    const filter = { userId };
    if (status) filter.status = status;
    if (platform) filter['platformSpecificData.platform'] = platform;

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('platformSpecificData.socialAccountId', 'platform profileInfo');

    const total = await Post.countDocuments(filter);

    res.json({
      success: true,
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      error: 'Failed to retrieve posts',
      code: 'POSTS_RETRIEVE_ERROR'
    });
  }
});

// Create new post
router.post('/', checkUsageLimit('posts'), async (req, res) => {
  try {
    const userId = req.user._id;
    const { content, mediaUrls, hashtags, mentions, scheduledAt, platformSpecificData, category } = req.body;

    if (!content || !platformSpecificData || platformSpecificData.length === 0) {
      return res.status(400).json({
        error: 'Content and platform data are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const post = new Post({
      userId,
      content,
      mediaUrls: mediaUrls || [],
      hashtags: hashtags || [],
      mentions: mentions || [],
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      platformSpecificData,
      category: category || 'other',
      status: scheduledAt ? 'scheduled' : 'draft'
    });

    await post.save();

    res.status(201).json({
      success: true,
      post,
      message: 'Post created successfully'
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      error: 'Failed to create post',
      code: 'POST_CREATE_ERROR'
    });
  }
});

// Get specific post
router.get('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const post = await Post.findOne({ _id: postId, userId })
      .populate('platformSpecificData.socialAccountId', 'platform profileInfo');

    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      post
    });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({
      error: 'Failed to retrieve post',
      code: 'POST_RETRIEVE_ERROR'
    });
  }
});

// Update post
router.put('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;
    const updates = req.body;

    const post = await Post.findOne({ _id: postId, userId });
    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }

    // Don't allow updates to posted content
    if (post.status === 'posted') {
      return res.status(400).json({
        error: 'Cannot update posted content',
        code: 'POST_ALREADY_POSTED'
      });
    }

    Object.assign(post, updates);
    await post.save();

    res.json({
      success: true,
      post,
      message: 'Post updated successfully'
    });

  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({
      error: 'Failed to update post',
      code: 'POST_UPDATE_ERROR'
    });
  }
});

// Delete post
router.delete('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const post = await Post.findOne({ _id: postId, userId });
    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }

    await post.deleteOne();

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      error: 'Failed to delete post',
      code: 'POST_DELETE_ERROR'
    });
  }
});

// Publish post immediately
router.post('/:postId/publish', async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const post = await Post.findOne({ _id: postId, userId });
    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }

    if (post.status === 'posted') {
      return res.status(400).json({
        error: 'Post already published',
        code: 'POST_ALREADY_POSTED'
      });
    }

    // Here you would implement actual posting to social platforms
    // For now, just mark as posted
    post.status = 'posted';
    post.postedAt = new Date();
    
    // Update platform-specific data
    post.platformSpecificData.forEach(psd => {
      psd.status = 'posted';
      psd.postedAt = new Date();
      psd.platformPostId = `mock_${psd.platform}_${Date.now()}`;
    });

    await post.save();

    res.json({
      success: true,
      post,
      message: 'Post published successfully'
    });

  } catch (error) {
    console.error('Publish post error:', error);
    res.status(500).json({
      error: 'Failed to publish post',
      code: 'POST_PUBLISH_ERROR'
    });
  }
});

export default router;
