# Auth Extractor Web

A web interface for extracting authentication and authorization patterns from GitHub repositories or uploaded zip files.

## Features

- 🔒 Extract auth providers (NextAuth, Firebase, Cognito, etc.)
- 🔑 Extract token strategies and refresh patterns
- 👥 Extract role models and permissions
- 🛡️ Extract permission checks and middleware
- 📦 Download auth-memory.ts file

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter a GitHub repository URL or upload a zip file
2. Click "Extract" to analyze the codebase
3. Download the generated `auth-memory.ts` file

## Environment Variables

Optional: Set `GITHUB_TOKEN` for higher rate limits when cloning repositories.

## Tech Stack

- Next.js 16
- TypeScript
- Tailwind CSS
- Framer Motion

