# AI Bartender - Frontend

A React application built with TypeScript, Tailwind CSS, and AWS Amplify for browsing drinks, placing orders, and chatting with an AI bartender.

## Features

- **Dark/Light Theme** - Automatic theme switching with user preference persistence
- **AWS Cognito Auth** - Hosted UI with OAuth2/PKCE flow for admin login
- **Real-time Updates** - Order status via AppSync Events WebSocket
- **AI Chat** - Streaming responses with typing effect (SSE)
- **Responsive** - Mobile-first design optimized for all devices
- **Accessibility** - WCAG AA compliant with keyboard navigation and screen reader support

## Tech Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling with custom design system
- **AWS Amplify** for authentication
- **React Router** for navigation
- **Framer Motion** for animations
- **React Hot Toast** for notifications
- **Vite** for build tooling

## Getting Started

### Prerequisites

- Node.js 20+
- Environment variables configured (see below)

### Installation

```bash
npm install
```

### Configuration

Copy the example environment file and update with your AWS values:

```bash
cp .env.example .env.development
```

See [.env.example](.env.example) for all required variables.

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Building

```bash
npm run build
```

The built files in `dist/` should be deployed to the S3 frontend bucket configured in the hosting infrastructure.

## Project Structure

```text
src/
├── components/          # Reusable UI components
│   ├── Admin/           # Admin dashboard components
│   ├── Chat/            # AI chat interface
│   ├── Drinks/          # Drink cards, modals, forms
│   ├── Orders/          # Order cards and status display
│   └── UI/              # Generic UI (buttons, forms, pagination)
├── config/              # Amplify configuration
├── contexts/            # React contexts (Theme, Auth)
├── hooks/               # Custom React hooks
├── pages/               # Route page components
├── services/            # API clients
├── types/               # TypeScript type definitions
└── utils/               # Utility functions
```

## Environment Variables

| Variable | Description | Example |
| -------- | ----------- | ------- |
| `VITE_API_ENDPOINT` | REST API Gateway endpoint | `https://api.your-domain.com` |
| `VITE_API_KEY` | API Gateway API key | `your-api-key` |
| `VITE_AWS_REGION` | AWS region | `eu-west-1` |
| `VITE_USER_POOL_ID` | Cognito User Pool ID | `eu-west-1_XXXXXXXXX` |
| `VITE_USER_POOL_CLIENT_ID` | Cognito client ID | `xxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `VITE_COGNITO_DOMAIN` | Cognito Hosted UI domain | `your-auth.auth.eu-west-1.amazoncognito.com` |
| `VITE_COGNITO_REDIRECT_SIGNIN` | OAuth redirect (sign in) | `http://localhost:5173/signin` |
| `VITE_COGNITO_REDIRECT_SIGNOUT` | OAuth redirect (sign out) | `http://localhost:5173/signout` |
| `VITE_APPSYNC_EVENTS_REALTIME_ENDPOINT` | AppSync WebSocket endpoint | `xxx.appsync-realtime-api.eu-west-1.amazonaws.com` |
| `VITE_APPSYNC_EVENTS_API_KEY` | AppSync API key | `da2-xxxxxxxxxxxxxxxxxxxxxxxx` |
| `VITE_CHAT_API_ENDPOINT` | Chat API endpoint | `https://chat.your-domain.com` |
| `VITE_CHAT_API_KEY` | Chat API key | `your-chat-api-key` |
| `VITE_CLOUDFRONT_DOMAIN` | CloudFront domain for images | `https://your-domain.com` |

## Design System

### Colors

- **Primary**: Vibrant Teal (#00D9C0)
- **Accent**: Electric Purple (#8B5CF6)
- **Status Colors**: Semantic colors for order states

### Typography

- **Font**: Inter with optimized loading
- **Scale**: Consistent typography scale from h1 to caption

### Components

- Consistent button styles (primary, secondary, danger)
- Card components with hover effects
- Form inputs with validation states
- Status badges with color coding
