# SocialSync AI

**Unify your social presence and amplify your reach.**

SocialSync AI is a comprehensive social media management platform that helps creators and businesses streamline content creation, scheduling, and engagement across multiple social platforms with AI-powered insights.

## 🚀 Features

### Core Features
- **Cross-Platform Content Composer**: Create and customize content for different social media platforms from a single interface
- **AI-Powered Posting Time Suggestions**: Get optimal posting times based on your audience activity and historical performance
- **Unified Inbox**: Manage all comments, messages, and mentions from connected social accounts in one place
- **Performance Dashboard**: View comprehensive analytics across all connected platforms

### AI-Powered Features
- Content suggestions based on your top-performing posts
- Hashtag recommendations
- Sentiment analysis of engagements
- Optimal posting time predictions
- Content performance scoring

### Supported Platforms
- Twitter
- LinkedIn
- Instagram
- Facebook

## 🛠 Tech Stack

### Frontend
- **React 18** with Vite
- **Tailwind CSS** for styling
- **Recharts** for analytics visualization
- **Lucide React** for icons
- **Framer Motion** for animations
- **React Hook Form** for form handling
- **Zustand** for state management

### Backend
- **Node.js** with Express
- **MongoDB** with Mongoose
- **JWT** for authentication
- **OpenAI API** for AI features
- **Passport.js** for OAuth
- **Stripe** for payments
- **Node-cron** for scheduling

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or higher)
- MongoDB (v5 or higher)
- npm or yarn

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/vistara-apps/this-is-a-7026.git
   cd this-is-a-7026
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file with your configuration:
   - Database connection string
   - JWT secret
   - OpenAI API key
   - Social media API credentials
   - Stripe keys (for subscriptions)

4. **Start MongoDB**
   Make sure MongoDB is running on your system.

5. **Run the application**
   
   **Development mode (with hot reload):**
   ```bash
   # Start the backend server
   npm run server
   
   # In another terminal, start the frontend
   npm run dev
   ```
   
   **Production mode:**
   ```bash
   npm run build
   npm start
   ```

## 🔑 API Keys Setup

### Required API Keys

1. **OpenAI API Key**
   - Sign up at [OpenAI](https://platform.openai.com/)
   - Create an API key
   - Add to `OPENAI_API_KEY` in `.env`

2. **Twitter API v2**
   - Apply for developer access at [Twitter Developer Portal](https://developer.twitter.com/)
   - Create a new app and get your credentials
   - Add `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`, and `TWITTER_BEARER_TOKEN`

3. **LinkedIn API**
   - Create an app at [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
   - Add `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`

4. **Facebook/Instagram API**
   - Create an app at [Facebook for Developers](https://developers.facebook.com/)
   - Add `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`

5. **Stripe (for subscriptions)**
   - Sign up at [Stripe](https://stripe.com/)
   - Get your API keys from the dashboard
   - Add `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`

## 📊 Database Schema

The application uses the following main data models:

### User
- User authentication and profile information
- Subscription plan and status
- Connected social accounts
- Preferences and settings

### SocialAccount
- Connected social media account details
- OAuth tokens and permissions
- Profile information and metrics
- Platform-specific settings

### Post
- Content and media URLs
- Scheduling information
- Platform-specific customizations
- Performance metrics
- AI suggestions

### Engagement
- Comments, mentions, and messages
- Author information
- Sentiment analysis
- Response tracking

## 🔄 User Flows

### 1. User Onboarding
1. User signs up with email and password
2. User connects social media accounts via OAuth
3. Application requests necessary permissions
4. Connected accounts appear in dashboard

### 2. Content Creation and Scheduling
1. User navigates to Content Composer
2. User writes content and uploads media
3. User selects target platforms with customizations
4. AI provides optimal posting time suggestions
5. User schedules post or publishes immediately

### 3. Engagement Management
1. User accesses Unified Inbox
2. New engagements appear in real-time
3. User can filter, search, and sort engagements
4. User responds directly from the inbox
5. Responses are posted to respective platforms

### 4. Performance Analysis
1. User views Analytics dashboard
2. Metrics are aggregated across platforms
3. User applies filters for specific insights
4. User identifies top-performing content and trends

## 🎨 Design System

The application follows a consistent design system:

### Colors
- **Primary**: `hsl(240 80% 50%)` - Main brand color
- **Accent**: `hsl(160 80% 40%)` - Call-to-action color
- **Surface**: `hsl(0 0% 100%)` - Card backgrounds
- **Background**: `hsl(240 10% 95%)` - Page background

### Typography
- **Display**: Large headings (text-5xl font-bold)
- **Heading**: Section headings (text-2xl font-semibold)
- **Body**: Regular text (text-lg leading-relaxed)

### Spacing
- **xs**: 4px
- **sm**: 8px
- **md**: 16px
- **lg**: 24px

### Components
- Glass morphism effects for cards
- Consistent border radius (4px, 8px, 12px)
- Smooth animations and transitions

## 📱 Subscription Plans

### Starter ($29/month)
- 3 connected accounts
- 50 posts per month
- 10 AI suggestions per month
- Basic analytics

### Pro ($79/month)
- 10 connected accounts
- 200 posts per month
- 100 AI suggestions per month
- Advanced analytics
- Priority support

### Business ($199/month)
- Unlimited connected accounts
- Unlimited posts
- Unlimited AI suggestions
- Team features
- Priority support
- Custom integrations

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Input validation and sanitization
- Secure OAuth token storage
- HTTPS enforcement in production

## 🚀 Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure production database
3. Set up proper JWT secrets
4. Configure HTTPS
5. Set up monitoring and logging

### Recommended Hosting
- **Frontend**: Vercel, Netlify, or AWS S3 + CloudFront
- **Backend**: Railway, Heroku, or AWS EC2
- **Database**: MongoDB Atlas
- **File Storage**: AWS S3 or Cloudinary

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@socialsync-ai.com or join our Discord community.

## 🗺 Roadmap

- [ ] Advanced analytics with custom date ranges
- [ ] Team collaboration features
- [ ] Content templates and campaigns
- [ ] Advanced AI content generation
- [ ] Mobile app (React Native)
- [ ] Integration with more platforms (TikTok, Pinterest)
- [ ] White-label solutions
- [ ] API for third-party integrations

---

**Built with ❤️ by the SocialSync AI team**
