# Perplexity AI Clone

An AI-powered search engine built with Next.js, Tavily, and Supabase.

**[Live Demo](https://perplexity-search-idmq8eswe-gohuls-projects.vercel.app/login)** · **[GitHub](https://github.com/gohul4151/perplexity-search-LLM)**

---

## Features

- AI-powered web search with real-time streaming answers
- Source citations with every response
- Persistent conversation history per user
- OAuth authentication via Google & GitHub (Supabase)
- Protected routes — unauthenticated users are redirected to login

## Tech Stack

| | |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | Supabase Auth (Google & GitHub OAuth) |
| Database | PostgreSQL via Supabase + Prisma ORM |
| AI Search | Tavily API |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- [Supabase](https://supabase.com/) project with Google & GitHub OAuth
- [Tavily](https://tavily.com/) API key

### 1. Clone

```bash
git clone https://github.com/gohul4151/perplexity-search-LLM.git
cd perplexity-search-LLM/perplexity-ai
```

### 2. Install

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file:

```env
TAVILY_API_KEY=

DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_SECRET=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_SECRET=
```

### 4. Database

```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

Built by [Gohul](https://github.com/gohul4151) · 100xDevs
