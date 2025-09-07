import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Middleware to authenticate JWT tokens
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get user from database
    const user = await User.findById(decoded.userId).populate('connectedAccounts');
    
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user's subscription is active
    if (user.subscriptionStatus !== 'active') {
      return res.status(403).json({ 
        error: 'Subscription required',
        code: 'SUBSCRIPTION_INACTIVE'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

// Middleware to check subscription plan requirements
export const requireSubscription = (requiredPlan) => {
  const planHierarchy = { starter: 1, pro: 2, business: 3 };
  
  return (req, res, next) => {
    const userPlanLevel = planHierarchy[req.user.subscriptionPlan] || 0;
    const requiredPlanLevel = planHierarchy[requiredPlan] || 0;

    if (userPlanLevel < requiredPlanLevel) {
      return res.status(403).json({
        error: `${requiredPlan} subscription required`,
        code: 'SUBSCRIPTION_UPGRADE_REQUIRED',
        currentPlan: req.user.subscriptionPlan,
        requiredPlan
      });
    }

    next();
  };
};

// Middleware to check usage limits
export const checkUsageLimit = (limitType) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const limits = user.getSubscriptionLimits();
      
      switch (limitType) {
        case 'accounts':
          if (limits.accounts !== -1 && user.connectedAccounts.length >= limits.accounts) {
            return res.status(403).json({
              error: 'Account connection limit reached',
              code: 'ACCOUNT_LIMIT_REACHED',
              limit: limits.accounts,
              current: user.connectedAccounts.length
            });
          }
          break;
          
        case 'posts':
          // Check monthly post limit
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          
          const Post = (await import('../models/Post.js')).default;
          const monthlyPosts = await Post.countDocuments({
            userId: user._id,
            createdAt: { $gte: startOfMonth }
          });
          
          if (limits.postsPerMonth !== -1 && monthlyPosts >= limits.postsPerMonth) {
            return res.status(403).json({
              error: 'Monthly post limit reached',
              code: 'POST_LIMIT_REACHED',
              limit: limits.postsPerMonth,
              current: monthlyPosts
            });
          }
          break;
          
        case 'ai':
          // Check AI suggestions limit (implement based on your tracking method)
          // This is a placeholder - you'd implement actual AI usage tracking
          break;
      }
      
      next();
    } catch (error) {
      console.error('Usage limit check error:', error);
      res.status(500).json({ 
        error: 'Failed to check usage limits',
        code: 'USAGE_CHECK_ERROR'
      });
    }
  };
};

// Middleware to validate request body
export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    next();
  };
};

// Middleware to log API requests
export const logRequest = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.userId || 'anonymous'
    };
    
    console.log('API Request:', JSON.stringify(logData));
  });
  
  next();
};

// Middleware to handle rate limiting (basic implementation)
const requestCounts = new Map();

export const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    const key = req.ip + (req.user?.userId || '');
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    for (const [k, timestamps] of requestCounts.entries()) {
      requestCounts.set(k, timestamps.filter(t => t > windowStart));
      if (requestCounts.get(k).length === 0) {
        requestCounts.delete(k);
      }
    }
    
    // Check current user's requests
    const userRequests = requestCounts.get(key) || [];
    
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    // Add current request
    userRequests.push(now);
    requestCounts.set(key, userRequests);
    
    next();
  };
};

export default {
  authenticateToken,
  requireSubscription,
  checkUsageLimit,
  validateRequest,
  logRequest,
  rateLimit
};
