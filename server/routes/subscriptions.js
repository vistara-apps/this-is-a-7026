import express from 'express';
import Stripe from 'stripe';
import User from '../models/User.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Get subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plans = [
      {
        id: 'starter',
        name: 'Starter',
        price: 29,
        currency: 'usd',
        interval: 'month',
        features: [
          '3 connected accounts',
          '50 posts per month',
          '10 AI suggestions per month',
          'Basic analytics',
          'Email support'
        ],
        limits: {
          accounts: 3,
          postsPerMonth: 50,
          aiSuggestions: 10
        }
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 79,
        currency: 'usd',
        interval: 'month',
        features: [
          '10 connected accounts',
          '200 posts per month',
          '100 AI suggestions per month',
          'Advanced analytics',
          'Priority support',
          'Content scheduling'
        ],
        limits: {
          accounts: 10,
          postsPerMonth: 200,
          aiSuggestions: 100
        },
        popular: true
      },
      {
        id: 'business',
        name: 'Business',
        price: 199,
        currency: 'usd',
        interval: 'month',
        features: [
          'Unlimited connected accounts',
          'Unlimited posts',
          'Unlimited AI suggestions',
          'Team features',
          'Priority support',
          'Custom integrations',
          'White-label options'
        ],
        limits: {
          accounts: -1,
          postsPerMonth: -1,
          aiSuggestions: -1
        }
      }
    ];

    res.json({
      success: true,
      plans
    });

  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      error: 'Failed to retrieve subscription plans',
      code: 'PLANS_ERROR'
    });
  }
});

// Get current subscription
router.get('/current', async (req, res) => {
  try {
    const user = req.user;
    
    let subscription = null;
    if (user.stripeCustomerId) {
      // Get subscription from Stripe
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'active',
        limit: 1
      });
      
      if (subscriptions.data.length > 0) {
        subscription = subscriptions.data[0];
      }
    }

    res.json({
      success: true,
      subscription: {
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus,
        endDate: user.subscriptionEndDate,
        stripeSubscription: subscription,
        limits: user.getSubscriptionLimits()
      }
    });

  } catch (error) {
    console.error('Get current subscription error:', error);
    res.status(500).json({
      error: 'Failed to retrieve current subscription',
      code: 'CURRENT_SUBSCRIPTION_ERROR'
    });
  }
});

// Create checkout session
router.post('/checkout', async (req, res) => {
  try {
    const { planId } = req.body;
    const user = req.user;

    if (!['starter', 'pro', 'business'].includes(planId)) {
      return res.status(400).json({
        error: 'Invalid plan ID',
        code: 'INVALID_PLAN'
      });
    }

    // Create or get Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName,
        metadata: {
          userId: user._id.toString()
        }
      });
      customerId = customer.id;
      
      // Update user with customer ID
      await User.findByIdAndUpdate(user._id, {
        stripeCustomerId: customerId
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `SocialSync AI ${planId.charAt(0).toUpperCase() + planId.slice(1)}`,
              description: `Monthly subscription to SocialSync AI ${planId} plan`
            },
            unit_amount: getPlanPrice(planId) * 100, // Convert to cents
            recurring: {
              interval: 'month'
            }
          },
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${process.env.CLIENT_URL}/dashboard?subscription=success`,
      cancel_url: `${process.env.CLIENT_URL}/pricing?subscription=cancelled`,
      metadata: {
        userId: user._id.toString(),
        planId
      }
    });

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      code: 'CHECKOUT_ERROR'
    });
  }
});

// Cancel subscription
router.post('/cancel', async (req, res) => {
  try {
    const user = req.user;

    if (!user.stripeCustomerId) {
      return res.status(400).json({
        error: 'No active subscription found',
        code: 'NO_SUBSCRIPTION'
      });
    }

    // Get active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return res.status(400).json({
        error: 'No active subscription found',
        code: 'NO_ACTIVE_SUBSCRIPTION'
      });
    }

    const subscription = subscriptions.data[0];

    // Cancel at period end
    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true
    });

    // Update user status
    await User.findByIdAndUpdate(user._id, {
      subscriptionStatus: 'cancelled'
    });

    res.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current billing period'
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      error: 'Failed to cancel subscription',
      code: 'CANCEL_SUBSCRIPTION_ERROR'
    });
  }
});

// Reactivate subscription
router.post('/reactivate', async (req, res) => {
  try {
    const user = req.user;

    if (!user.stripeCustomerId) {
      return res.status(400).json({
        error: 'No subscription found',
        code: 'NO_SUBSCRIPTION'
      });
    }

    // Get subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return res.status(400).json({
        error: 'No subscription found',
        code: 'NO_SUBSCRIPTION_FOUND'
      });
    }

    const subscription = subscriptions.data[0];

    // Reactivate subscription
    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: false
    });

    // Update user status
    await User.findByIdAndUpdate(user._id, {
      subscriptionStatus: 'active'
    });

    res.json({
      success: true,
      message: 'Subscription reactivated successfully'
    });

  } catch (error) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({
      error: 'Failed to reactivate subscription',
      code: 'REACTIVATE_SUBSCRIPTION_ERROR'
    });
  }
});

// Webhook handler for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Helper functions
function getPlanPrice(planId) {
  const prices = {
    starter: 29,
    pro: 79,
    business: 199
  };
  return prices[planId] || 29;
}

async function handleCheckoutCompleted(session) {
  const userId = session.metadata.userId;
  const planId = session.metadata.planId;
  
  await User.findByIdAndUpdate(userId, {
    subscriptionPlan: planId,
    subscriptionStatus: 'active',
    stripeCustomerId: session.customer
  });
}

async function handlePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  const user = await User.findOne({ stripeCustomerId: customerId });
  
  if (user) {
    await User.findByIdAndUpdate(user._id, {
      subscriptionStatus: 'active'
    });
  }
}

async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;
  const user = await User.findOne({ stripeCustomerId: customerId });
  
  if (user) {
    await User.findByIdAndUpdate(user._id, {
      subscriptionStatus: 'past_due'
    });
  }
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  const user = await User.findOne({ stripeCustomerId: customerId });
  
  if (user) {
    const status = subscription.status === 'active' ? 'active' : 
                  subscription.status === 'past_due' ? 'past_due' : 'inactive';
    
    await User.findByIdAndUpdate(user._id, {
      subscriptionStatus: status,
      subscriptionEndDate: new Date(subscription.current_period_end * 1000)
    });
  }
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  const user = await User.findOne({ stripeCustomerId: customerId });
  
  if (user) {
    await User.findByIdAndUpdate(user._id, {
      subscriptionStatus: 'cancelled',
      subscriptionPlan: 'starter' // Downgrade to starter
    });
  }
}

export default router;
