# DojoPay

DojoPay is a decentralized task marketplace built on Solana, its a platform that connects creators with workers through instant task despensation, secure SOL payments and escrow services.

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Security](#security)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## Overview

DojoPay revolutionizes the gig economy by leveraging Solana blockchain for instant, secure payments. Creators can define tasks, set payments, and receive verified work submissions, while workers earn SOL by completing tasks with automatic payment verification.

### Current Implementation

**Image Labeling Platform**
- Task Type: Image annotation and labeling
- Workflow: Creators upload images → Workers label → System verifies → Auto-payment
- Payment: 0.1 SOL per completed task
- Verification: Automated validation of submitted labels

## Features

### For Creators
- **Task Management**: Create and manage multiple task types
- **Escrow Services**: Secure payment holding until task verification
- **Analytics Dashboard**: Track task performance and worker metrics
- **Secure Payments**: Automatic SOL transfers upon verification

### For Workers
- **Task Discovery**: Browse available jobs matching your skills
- **Instant Payments**: Receive SOL automatically upon verification
- **Reputation System**: Build your profile with quality work ratings
- **Diverse Opportunities**: Access various task types and projects

### Platform Capabilities
- **Multi-task Support**: Image labeling, text classification, data annotation, content creation, quality assurance, and research tasks
- **Blockchain Integration**: Non-custodial wallet connections with secure smart contracts
<!-- - **Real-time Updates**: Live status tracking via WebSocket connections -->
- **Marketplace**: Advanced task discovery and worker matching

## How It Works

### For Creators

1. **Connect Wallet**: Authenticate with your Solana wallet (Phantom, Solflare, etc.)
2. **Define Task**: Set requirements, payment amount, and verification criteria
3. **Deposit Funds**: SOL held in escrow until task completion
4. **Review Submissions**: Approve or reject completed work
5. **Auto-Payment**: System releases SOL to verified workers

### For Workers

1. **Browse Tasks**: Find available jobs matching your skills
2. **Complete Work**: Submit tasks according to requirements
3. **Get Paid**: Receive SOL automatically upon verification
4. **Build Reputation**: Earn ratings for quality work

## Tech Stack

### Backend
- **Runtime**: Node.js 22+
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + Solana Web3.js
- **Storage**: AWS S3
- **Deployment**: Render

### Frontend
- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Blockchain**: Solana Wallet Adapter
- **Deployment**: Vercel

### Blockchain
- **Network**: Solana Devnet (for now)
- **Wallets**: Phantom, Solflare, and more
- **Smart Contracts - pending**: Rust-based programs (for better vault and escrow management) 

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL database
- Solana wallet (Phantom, Solflare, etc.)
- AWS S3 bucket (for file storage)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/kingsleycj/dojopay.git
cd dojopay
```

2. **Backend Setup**

```bash
cd backend
npm install
cp .env.example .env
# Configure environment variables in .env
npm run dev
```

3. **Frontend Setup**

```bash
cd frontend
npm install
cp .env.example .env.local
# Configure environment variables in .env.local
npm run dev
```

### Environment Variables

#### Backend (`.env`)

```env
DATABASE_URL=postgresql://...
RPC_URL=https://api.mainnet-beta.solana.com
PRIVATE_KEY=your_wallet_private_key
JWT_SECRET=your_jwt_secret
S3_BUCKET_NAME=your_s3_bucket
S3_BUCKET_ACCESS_KEY_ID=...
S3_BUCKET_SECRET_ACCESS_KEY=...
```

#### Frontend (`.env.local`)

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_CLOUDFRONT_URL=https://your-cloudfront-domain.cloudfront.net/
```

## API Documentation

### Creator Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/user/signin` | Authenticate with Solana wallet |
| POST | `/v1/user/task` | Create new task |
| GET | `/v1/user/tasks` | List created tasks |
| GET | `/v1/user/analytics` | View task statistics |

### Worker Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/worker/signin` | Authenticate worker |
| GET | `/v1/worker/tasks` | Browse available tasks |
| POST | `/v1/worker/submit` | Submit completed task |
| GET | `/v1/worker/earnings` | View payment history |

## Deployment

### Backend (Render)

1. Connect your GitHub repository
2. Set environment variables
3. Deploy from `backend` directory
4. Configure PostgreSQL database

### Frontend (Vercel)

1. Connect your GitHub repository
2. Set environment variables
3. Deploy from `frontend` directory
4. Configure custom domain (optional)

## Security

- **Non-custodial**: Users control their own SOL wallets
- **Escrow System**: Payments held until task verification
- **Rate Limiting**: Protection against API abuse
- **Input Validation**: All user inputs are sanitized
- **HTTPS**: Encrypted communication
- **CORS**: Cross-origin protection

## Roadmap

### Q4 2025
- [ ] Multi-task type support
- [ ] Advanced verification system
- [ ] Mobile app development

### Q1 2026
- [ ] Reputation system
- [ ] Escrow smart contracts
- [ ] API v2 release

### Q2 2026
- [ ] Real-time updates
- [ ] Marketplace features
- [ ] Advanced analytics
- [ ] Enterprise solutions

## Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- **Documentation**: [Project Wiki](https://github.com/kingsleycj/dojopay/wiki)
- **Issues**: [GitHub Issues](https://github.com/kingsleycj/dojopay/issues)
- **Discord**: [Community Server](#)

<!-- ## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details. -->

---

**Built with ❤️ on Solana**