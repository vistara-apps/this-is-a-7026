import OpenAI from 'openai';
import Post from '../models/Post.js';
import SocialAccount from '../models/SocialAccount.js';
import Engagement from '../models/Engagement.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class AIService {
  
  // Generate content suggestions based on user's past performance
  async generateContentSuggestions(userId, platform = null, category = null) {
    try {
      // Get user's top performing posts for context
      const topPosts = await Post.find({
        userId,
        status: 'posted',
        'performanceMetrics.engagementRate': { $gt: 5 }
      })
      .sort({ 'performanceMetrics.engagementRate': -1 })
      .limit(5)
      .select('content category performanceMetrics.engagementRate');

      // Get platform-specific context
      let platformContext = '';
      if (platform) {
        const platformLimits = {
          twitter: { limit: 280, style: 'concise and engaging' },
          linkedin: { limit: 3000, style: 'professional and insightful' },
          instagram: { limit: 2200, style: 'visual and inspiring' },
          facebook: { limit: 63206, style: 'conversational and community-focused' }
        };
        
        const platformInfo = platformLimits[platform];
        if (platformInfo) {
          platformContext = `This content is for ${platform}. Keep it ${platformInfo.style} and under ${platformInfo.limit} characters.`;
        }
      }

      const prompt = `
        As a social media content expert, generate 3 engaging content suggestions.
        
        Context:
        - ${platformContext}
        - Category: ${category || 'general'}
        - User's top performing content themes: ${topPosts.map(p => p.content.substring(0, 100)).join(', ')}
        
        Requirements:
        - Make content engaging and authentic
        - Include relevant hashtag suggestions
        - Provide different content types (educational, entertaining, promotional)
        - Consider current trends and best practices
        
        Return as JSON array with format:
        [
          {
            "content": "suggested post content",
            "hashtags": ["hashtag1", "hashtag2"],
            "type": "educational|entertaining|promotional",
            "reasoning": "why this content would perform well"
          }
        ]
      `;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
      });

      const suggestions = JSON.parse(response.choices[0].message.content);
      return suggestions;

    } catch (error) {
      console.error('AI content suggestion error:', error);
      throw new Error('Failed to generate content suggestions');
    }
  }

  // Analyze content and provide improvement suggestions
  async analyzeContent(content, platform, userId) {
    try {
      // Get platform-specific guidelines
      const platformGuidelines = {
        twitter: 'Twitter favors concise, timely content with hashtags and mentions',
        linkedin: 'LinkedIn rewards professional insights, industry knowledge, and thought leadership',
        instagram: 'Instagram prioritizes visual storytelling with engaging captions and relevant hashtags',
        facebook: 'Facebook values community engagement, storytelling, and conversation starters'
      };

      const prompt = `
        Analyze this social media content for ${platform}:
        "${content}"
        
        Platform guidelines: ${platformGuidelines[platform]}
        
        Provide analysis in JSON format:
        {
          "score": 0-100,
          "strengths": ["strength1", "strength2"],
          "improvements": ["improvement1", "improvement2"],
          "hashtag_suggestions": ["hashtag1", "hashtag2"],
          "engagement_prediction": "low|medium|high",
          "optimal_length": "current length assessment",
          "tone_analysis": "professional|casual|enthusiastic|etc"
        }
      `;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      return analysis;

    } catch (error) {
      console.error('AI content analysis error:', error);
      throw new Error('Failed to analyze content');
    }
  }

  // Calculate optimal posting times based on historical data
  async calculateOptimalPostingTimes(userId, platform) {
    try {
      // Get user's historical post performance data
      const posts = await Post.find({
        userId,
        status: 'posted',
        'platformSpecificData.platform': platform,
        postedAt: { $exists: true }
      })
      .select('postedAt performanceMetrics.engagementRate performanceMetrics.totalEngagement')
      .sort({ postedAt: -1 })
      .limit(50);

      if (posts.length < 5) {
        // Not enough data, return general best practices
        return this.getDefaultOptimalTimes(platform);
      }

      // Analyze posting times and engagement
      const timeAnalysis = posts.map(post => ({
        hour: post.postedAt.getHours(),
        dayOfWeek: post.postedAt.getDay(),
        engagementRate: post.performanceMetrics.engagementRate || 0,
        totalEngagement: post.performanceMetrics.totalEngagement || 0
      }));

      // Group by hour and calculate average engagement
      const hourlyPerformance = {};
      timeAnalysis.forEach(data => {
        if (!hourlyPerformance[data.hour]) {
          hourlyPerformance[data.hour] = { total: 0, count: 0, engagement: 0 };
        }
        hourlyPerformance[data.hour].total += data.engagementRate;
        hourlyPerformance[data.hour].count += 1;
        hourlyPerformance[data.hour].engagement += data.totalEngagement;
      });

      // Calculate averages and find top 3 hours
      const hourlyAverages = Object.entries(hourlyPerformance)
        .map(([hour, data]) => ({
          hour: parseInt(hour),
          avgEngagementRate: data.total / data.count,
          avgEngagement: data.engagement / data.count
        }))
        .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
        .slice(0, 3);

      // Group by day of week
      const dailyPerformance = {};
      timeAnalysis.forEach(data => {
        if (!dailyPerformance[data.dayOfWeek]) {
          dailyPerformance[data.dayOfWeek] = { total: 0, count: 0 };
        }
        dailyPerformance[data.dayOfWeek].total += data.engagementRate;
        dailyPerformance[data.dayOfWeek].count += 1;
      });

      const bestDays = Object.entries(dailyPerformance)
        .map(([day, data]) => ({
          day: parseInt(day),
          avgEngagementRate: data.total / data.count
        }))
        .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
        .slice(0, 3);

      return {
        platform,
        optimalHours: hourlyAverages.map(h => ({
          hour: h.hour,
          score: Math.round(h.avgEngagementRate * 100) / 100,
          timeString: this.formatHour(h.hour)
        })),
        optimalDays: bestDays.map(d => ({
          day: d.day,
          score: Math.round(d.avgEngagementRate * 100) / 100,
          dayString: this.getDayName(d.day)
        })),
        confidence: posts.length >= 20 ? 'high' : posts.length >= 10 ? 'medium' : 'low',
        dataPoints: posts.length
      };

    } catch (error) {
      console.error('Optimal timing calculation error:', error);
      return this.getDefaultOptimalTimes(platform);
    }
  }

  // Get default optimal times based on platform best practices
  getDefaultOptimalTimes(platform) {
    const defaults = {
      twitter: {
        optimalHours: [
          { hour: 9, score: 8.5, timeString: '9:00 AM' },
          { hour: 15, score: 8.2, timeString: '3:00 PM' },
          { hour: 21, score: 7.8, timeString: '9:00 PM' }
        ],
        optimalDays: [
          { day: 2, score: 8.0, dayString: 'Tuesday' },
          { day: 3, score: 8.2, dayString: 'Wednesday' },
          { day: 4, score: 7.9, dayString: 'Thursday' }
        ]
      },
      linkedin: {
        optimalHours: [
          { hour: 8, score: 8.8, timeString: '8:00 AM' },
          { hour: 12, score: 8.5, timeString: '12:00 PM' },
          { hour: 17, score: 8.0, timeString: '5:00 PM' }
        ],
        optimalDays: [
          { day: 2, score: 8.5, dayString: 'Tuesday' },
          { day: 3, score: 8.7, dayString: 'Wednesday' },
          { day: 4, score: 8.3, dayString: 'Thursday' }
        ]
      },
      instagram: {
        optimalHours: [
          { hour: 11, score: 8.3, timeString: '11:00 AM' },
          { hour: 14, score: 8.1, timeString: '2:00 PM' },
          { hour: 19, score: 8.6, timeString: '7:00 PM' }
        ],
        optimalDays: [
          { day: 1, score: 8.2, dayString: 'Monday' },
          { day: 4, score: 8.4, dayString: 'Thursday' },
          { day: 5, score: 8.0, dayString: 'Friday' }
        ]
      },
      facebook: {
        optimalHours: [
          { hour: 13, score: 8.0, timeString: '1:00 PM' },
          { hour: 15, score: 8.2, timeString: '3:00 PM' },
          { hour: 20, score: 7.9, timeString: '8:00 PM' }
        ],
        optimalDays: [
          { day: 2, score: 8.1, dayString: 'Tuesday' },
          { day: 3, score: 8.3, dayString: 'Wednesday' },
          { day: 6, score: 7.8, dayString: 'Saturday' }
        ]
      }
    };

    return {
      platform,
      ...defaults[platform],
      confidence: 'default',
      dataPoints: 0
    };
  }

  // Generate hashtag suggestions based on content
  async generateHashtags(content, platform, maxHashtags = 5) {
    try {
      const prompt = `
        Generate relevant hashtags for this ${platform} post:
        "${content}"
        
        Requirements:
        - Maximum ${maxHashtags} hashtags
        - Mix of popular and niche hashtags
        - Relevant to content and platform
        - Consider current trends
        
        Return as JSON array: ["hashtag1", "hashtag2", ...]
      `;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 200
      });

      const hashtags = JSON.parse(response.choices[0].message.content);
      return hashtags;

    } catch (error) {
      console.error('Hashtag generation error:', error);
      return [];
    }
  }

  // Analyze sentiment of engagement content
  async analyzeSentiment(text) {
    try {
      const prompt = `
        Analyze the sentiment of this text:
        "${text}"
        
        Return JSON: {"sentiment": "positive|negative|neutral", "confidence": 0-1, "keywords": ["word1", "word2"]}
      `;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 100
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      return analysis;

    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return { sentiment: 'neutral', confidence: 0, keywords: [] };
    }
  }

  // Helper methods
  formatHour(hour) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  }

  getDayName(dayIndex) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayIndex];
  }

  // Get next optimal posting time
  async getNextOptimalTime(userId, platform) {
    try {
      const optimalTimes = await this.calculateOptimalPostingTimes(userId, platform);
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay();

      // Find next optimal hour today or tomorrow
      let nextTime = new Date(now);
      
      // Check if there's an optimal hour later today
      const todayOptimalHours = optimalTimes.optimalHours
        .filter(h => h.hour > currentHour)
        .sort((a, b) => a.hour - b.hour);

      if (todayOptimalHours.length > 0) {
        nextTime.setHours(todayOptimalHours[0].hour, 0, 0, 0);
      } else {
        // Move to tomorrow and use the first optimal hour
        nextTime.setDate(nextTime.getDate() + 1);
        nextTime.setHours(optimalTimes.optimalHours[0].hour, 0, 0, 0);
      }

      return {
        suggestedTime: nextTime,
        reasoning: `Based on your historical data, ${this.formatHour(nextTime.getHours())} typically performs well on ${platform}`,
        confidence: optimalTimes.confidence
      };

    } catch (error) {
      console.error('Next optimal time calculation error:', error);
      
      // Return a default suggestion
      const defaultTime = new Date();
      defaultTime.setHours(defaultTime.getHours() + 2, 0, 0, 0);
      
      return {
        suggestedTime: defaultTime,
        reasoning: 'Suggested based on general best practices',
        confidence: 'low'
      };
    }
  }
}

export default new AIService();
