<div align="center">

# 🔍 Perplexity AI Clone

### An AI-powered search engine built with Next.js, Tavily & Supabase

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-green?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Tavily](https://img.shields.io/badge/Tavily-AI%20Search-purple?style=for-the-badge)](https://tavily.com/)

**[🚀 Live Demo]([https://your-deployed-link-here.vercel.app](https://perplexity-search-idmq8eswe-gohuls-projects.vercel.app/login))** &nbsp;|&nbsp; **[📁 Repository](https://github.com/gohul4151/perplexity-search-LLM)**

</div>

---

## 📸 Preview

> _Add a screenshot or GIF of your app here once deployed._

---

## ✨ Features

- 🔍 **AI-Powered Search** — Uses Tavily's advanced search with built-in answer generation to provide accurate, real-time answers from the web
- 💬 **Persistent Conversations** — Every search thread is saved and linked to your account — continue where you left off
- 🔐 **OAuth Authentication** — Sign in securely with **Google** or **GitHub** via Supabase Auth
- 📚 **Source Citations** — Every answer is backed by real web sources, displayed below the response
- 🌐 **Full-Stack Next.js** — API routes and React UI live in the same codebase
- 🗃️ **PostgreSQL + Prisma** — Fully typed database access using Prisma ORM on a hosted Supabase Postgres instance
- ⚡ **Streaming Responses** — Answers stream to the browser in real time for a snappy user experience
- 🛡️ **Protected Routes** — Middleware enforces authentication on every page; unauthenticated users are redirected to `/login`

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 |
| **Auth** | Supabase Auth (Google & GitHub OAuth) |
| **Database** | PostgreSQL (via Supabase) |
| **ORM** | Prisma 7 |
| **AI Search** | Tavily API (`includeAnswer: true`) |
| **Deployment** | Vercel |

---

## 🗂️ Project Structure

```
perplexity-ai/
├── app/
│   ├── page.tsx                    # Main chat/search UI
│   ├── layout.tsx                  # Root layout
│   ├── login/
│   │   └── page.tsx                # OAuth sign-in page (Google & GitHub)
│   ├── auth/
│   │   └── callback/route.ts       # Supabase OAuth callback handler
│   └── backend/
│       ├── db.ts                   # Prisma client singleton
│       ├── user.ts                 # User sync helper (Supabase → Prisma)
│       └── conversation/
│           ├── route.ts            # POST /backend/conversation (core API)
│           └── prompt.ts           # System prompt & prompt template
├── lib/
│   └── supabase/
│       ├── client.ts               # Browser Supabase client
│       ├── server.ts               # Server Supabase client
│       └── middleware.ts           # Session refresh middleware
├── prisma/
│   └── schema.prisma               # Database schema
├── middleware.ts                   # Auth guard (protects all routes)
└── .env                            # Environment variables
```

---

## 🗄️ Database Schema

```prisma
model User {
  id            String         @id @default(uuid())
  email         String         @unique
  name          String
  supabaseId    String         @unique
  provider      AuthProvider   // Google | Github
  conversations Conversation[]
}

model Conversation {
  id      String    @id @default(uuid())
  title   String?
  slug    String    @unique
  userId  String
  user    User      @relation(fields: [userId], references: [id])
  message Message[]
}

model Message {
  id             Int          @id @default(autoincrement())
  content        String
  role           MessageRole  // User | Assistant
  conversationId String
  createAt       DateTime     @default(now())
  conversation   Conversation @relation(...)
}
```

---

## ⚙️ How It Works

```
User submits a query
        │
        ▼
1. Auth check via Supabase session
        │
        ▼
2. Sync user → PostgreSQL (via Prisma)
        │
        ▼
3. Open / continue conversation thread
        │
        ▼
4. Save user message to DB
        │
        ▼
5. Call Tavily API (advanced search + includeAnswer: true)
        │
        ▼
6. Stream answer + sources back to browser
        │
        ▼
7. Save assistant message to DB (after stream ends)
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project with Google & GitHub OAuth configured
- A [Tavily](https://tavily.com/) API key (free tier available)

### 1. Clone the repo

```bash
git clone https://github.com/gohul4151/perplexity-search-LLM.git
cd perplexity-search-LLM/perplexity-ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the project root:

```env
# Tavily — AI-powered web search
TAVILY_API_KEY=your_tavily_api_key

# Supabase
DATABASE_URL=your_supabase_postgres_connection_string
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key

# OAuth (configured in Supabase dashboard)
GITHUB_OAUTH_CLIENT_ID=your_github_client_id
GITHUB_OAUTH_SECRET=your_github_secret
GOOGLE_OAUTH_CLIENT_ID=your_google_client_id
GOOGLE_OAUTH_SECRET=your_google_secret

# NextAuth
NEXTAUTH_SECRET=your_random_secret
NEXTAUTH_URL=http://localhost:3000
```

### 4. Run database migrations

```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌍 Deployment

This project is deployed on **Vercel**. To deploy your own copy:

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com/)
3. Add all environment variables from your `.env` file in the Vercel dashboard
4. Update the Supabase OAuth redirect URL to your Vercel deployment URL: `https://your-app.vercel.app/auth/callback`
5. Deploy!

**🔗 Live URL:** `https://your-deployed-link-here.vercel.app`

> _Update the link above once deployed._

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

<div align="center">

Built with ❤️ by [Gohul](https://github.com/gohul4151) &nbsp;|&nbsp; Part of the **100xDevs** learning journey

</div>
