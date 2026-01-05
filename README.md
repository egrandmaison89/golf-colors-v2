# Golf Colors v2

A PGA Tour tournament competition app for friends. This is an intentional rebuild of v1, focusing on clean architecture, maintainability, and production-quality patterns.

## Purpose

Golf Colors allows friends to create private competition groups for PGA Tour tournaments. Users make picks (select golfers) and compete based on tournament results.

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **State Management**: React Context API + Custom Hooks
- **Deployment**: Netlify

## Architecture

This project follows a **feature-based architecture** with clear separation of concerns:

- **Features**: Self-contained modules (auth, tournaments, golfers, competitions)
- **Services Layer**: Data fetching and API interactions
- **Hooks Layer**: Reusable data fetching hooks with caching
- **Components**: UI components organized by feature

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## Key Improvements from v1

1. **Intentional Architecture**: Feature-based organization with clear boundaries
2. **Strategic Caching**: Multi-layer caching to manage API rate limits (1000/day)
3. **Type Safety**: Strict TypeScript throughout
4. **Documentation**: Comprehensive docs explaining decisions and structure
5. **Production-Ready**: Error handling, loading states, environment management

See [TECHNICAL_DECISIONS.md](./TECHNICAL_DECISIONS.md) for what changed and why.

## Local Setup

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   
   Then edit `.env.local` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-supabase-project-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

## Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── ui/           # Base UI primitives
│   └── layout/       # Layout components
├── features/          # Feature modules
│   ├── auth/         # Authentication
│   ├── tournaments/   # PGA Tour tournaments
│   ├── golfers/       # Golfer data
│   └── competitions/  # User competitions
├── lib/              # Shared utilities
│   ├── supabase/     # Supabase client
│   ├── utils/        # Utility functions
│   └── constants/    # App constants
├── contexts/         # React Context providers
└── types/            # Global TypeScript types
```

## Development

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Caching Strategy

This app implements a multi-layer caching strategy to manage API rate limits:

1. **In-Memory Cache**: React state (session-based)
2. **Database Cache**: Supabase stores API data with refresh intervals
3. **External API**: Only called when cache is stale or missing

See [CACHING_STRATEGY.md](./CACHING_STRATEGY.md) for details.

## Build Plan

Development follows an incremental build plan:

1. ✅ Foundation (project setup, Supabase, routing)
2. ⏳ Authentication
3. ⏳ Core data models
4. ⏳ Golfer feature
5. ⏳ Tournament feature
6. ⏳ Competition feature
7. ⏳ Picks feature
8. ⏳ Scoring & leaderboard
9. ⏳ Polish & production readiness

See [BUILD_PLAN.md](./BUILD_PLAN.md) for the complete plan.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design decisions
- [TECHNICAL_DECISIONS.md](./TECHNICAL_DECISIONS.md) - What changed from v1 and why
- [BUILD_PLAN.md](./BUILD_PLAN.md) - Incremental implementation plan
- [CACHING_STRATEGY.md](./CACHING_STRATEGY.md) - API rate limit management
- [STACK_PROPOSAL.md](./STACK_PROPOSAL.md) - Technology choices and rationale

## What I Learned Rebuilding This

This rebuild was an exercise in intentional architecture and production-quality patterns. Key learnings:

- **Feature-based organization** makes code easier to find and maintain
- **Services layer** provides clear boundaries and enables strategic caching
- **TypeScript strict mode** catches errors early and improves code quality
- **Documentation** is as important as code - it explains the "why"
- **Caching strategy** is critical when working with rate-limited APIs
- **Incremental building** maintains working state and reduces risk

## License

Private project - not for public use.
