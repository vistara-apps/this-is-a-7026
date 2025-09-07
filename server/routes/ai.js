import express from 'express';
import aiService from '../services/aiService.js';
import { checkUsageLimit } from '../middleware/auth.js';

const router = express.Router();

// Generate content suggestions
router.post('/content-suggestions', checkUsageLimit('ai'), async (req, res) => {
  try {
    const { platform, category } = req.body;
    const userId = req.user._id;

    const suggestions = await aiService.generateContentSuggestions(userId, platform, category);

    res.json({
      success: true,
      suggestions,
      message: 'Content suggestions generated successfully'
    });

  } catch (error) {
    console.error('Content suggestions error:', error);
    res.status(500).json({
      error: 'Failed to generate content suggestions',
      code: 'AI_SUGGESTIONS_ERROR'
    });
  }
});

// Analyze content
router.post('/analyze-content', checkUsageLimit('ai'), async (req, res) => {
  try {
    const { content, platform } = req.body;
    const userId = req.user._id;

    if (!content || !platform) {
      return res.status(400).json({
        error: 'Content and platform are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    const analysis = await aiService.analyzeContent(content, platform, userId);

    res.json({
      success: true,
      analysis,
      message: 'Content analyzed successfully'
    });

  } catch (error) {
    console.error('Content analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze content',
      code: 'AI_ANALYSIS_ERROR'
    });
  }
});

// Get optimal posting times
router.get('/optimal-times/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const userId = req.user._id;

    if (!['twitter', 'linkedin', 'instagram', 'facebook'].includes(platform)) {
      return res.status(400).json({
        error: 'Invalid platform',
        code: 'INVALID_PLATFORM'
      });
    }

    const optimalTimes = await aiService.calculateOptimalPostingTimes(userId, platform);

    res.json({
      success: true,
      optimalTimes,
      message: 'Optimal posting times calculated successfully'
    });

  } catch (error) {
    console.error('Optimal times calculation error:', error);
    res.status(500).json({
      error: 'Failed to calculate optimal posting times',
      code: 'AI_TIMING_ERROR'
    });
  }
});

// Get next optimal posting time
router.get('/next-optimal-time/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const userId = req.user._id;

    if (!['twitter', 'linkedin', 'instagram', 'facebook'].includes(platform)) {
      return res.status(400).json({
        error: 'Invalid platform',
        code: 'INVALID_PLATFORM'
      });
    }

    const nextOptimalTime = await aiService.getNextOptimalTime(userId, platform);

    res.json({
      success: true,
      nextOptimalTime,
      message: 'Next optimal posting time calculated successfully'
    });

  } catch (error) {
    console.error('Next optimal time calculation error:', error);
    res.status(500).json({
      error: 'Failed to calculate next optimal posting time',
      code: 'AI_NEXT_TIME_ERROR'
    });
  }
});

// Generate hashtags
router.post('/generate-hashtags', checkUsageLimit('ai'), async (req, res) => {
  try {
    const { content, platform, maxHashtags = 5 } = req.body;

    if (!content || !platform) {
      return res.status(400).json({
        error: 'Content and platform are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    const hashtags = await aiService.generateHashtags(content, platform, maxHashtags);

    res.json({
      success: true,
      hashtags,
      message: 'Hashtags generated successfully'
    });

  } catch (error) {
    console.error('Hashtag generation error:', error);
    res.status(500).json({
      error: 'Failed to generate hashtags',
      code: 'AI_HASHTAG_ERROR'
    });
  }
});

// Analyze sentiment
router.post('/analyze-sentiment', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Text is required',
        code: 'MISSING_TEXT'
      });
    }

    const sentiment = await aiService.analyzeSentiment(text);

    res.json({
      success: true,
      sentiment,
      message: 'Sentiment analyzed successfully'
    });

  } catch (error) {
    console.error('Sentiment analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze sentiment',
      code: 'AI_SENTIMENT_ERROR'
    });
  }
});

// Get AI usage statistics for the user
router.get('/usage-stats', async (req, res) => {
  try {
    const userId = req.user._id;
    const user = req.user;
    
    // Get current month usage (this would be tracked in a real implementation)
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    // For now, return mock data - in production, you'd track actual usage
    const limits = user.getSubscriptionLimits();
    
    const usageStats = {
      aiSuggestions: {
        used: 5, // This would be tracked in database
        limit: limits.aiSuggestions,
        resetDate: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
      },
      contentAnalysis: {
        used: 12,
        limit: limits.aiSuggestions * 2, // Assuming 2x limit for analysis
        resetDate: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
      },
      hashtagGeneration: {
        used: 8,
        limit: limits.aiSuggestions * 3, // Assuming 3x limit for hashtags
        resetDate: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
      }
    };

    res.json({
      success: true,
      usageStats,
      message: 'AI usage statistics retrieved successfully'
    });

  } catch (error) {
    console.error('AI usage stats error:', error);
    res.status(500).json({
      error: 'Failed to get AI usage statistics',
      code: 'AI_USAGE_STATS_ERROR'
    });
  }
});

export default router;
