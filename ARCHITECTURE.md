# Golf Colors v2 - Architecture Plan

## High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   UI Layer   │→ │  State Layer │→ │ Service Layer│     │
│  │  Components  │  │   (Context)  │  │  (Supabase)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Backend                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Auth       │  │  Database    │  │  Storage     │     │
│  │  (Users)     │  │  (PostgreSQL)│  │  (Headshots) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Folder Structure

```
golf-colors-v2/
├── public/                    # Static assets
│   └── headshots/            # Golfer headshot images
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ui/               # Base UI primitives (Button, Card, etc.)
│   │   └── layout/           # Layout components (Header, Footer, etc.)
│   ├── features/             # Feature modules (feature-based organization)
│   │   ├── auth/             # Authentication feature
│   │   │   ├── components/   # Auth-specific components
│   │   │   ├── hooks/        # Auth hooks (useAuth, etc.)
│   │   │   └── types.ts      # Auth types
│   │   ├── tournaments/      # Tournament feature
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/     # Tournament data fetching
│   │   │   └── types.ts
│   │   ├── golfers/          # Golfer feature
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types.ts
│   │   └── competitions/     # Competition/picks feature
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── services/
│   │       └── types.ts
│   │   └── leaderboard/      # Annual leaderboard feature
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── services/
│   │       └── types.ts
│   ├── lib/                  # Shared utilities and configurations
│   │   ├── supabase/         # Supabase client setup
│   │   ├── api/              # External API clients (sportsdata.io)
│   │   ├── utils/            # Pure utility functions
│   │   └── constants/        # App constants
│   ├── types/                # Global TypeScript types
│   ├── contexts/             # React Context providers
│   ├── App.tsx               # Root component
│   └── main.tsx              # Entry point
├── .env.local                # Local environment variables (gitignored)
├── .env.example              # Example env file
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Data Flow Explanation

### 1. **Authentication Flow**
```
User Action → Auth Component → useAuth Hook → Supabase Auth Service → Context Update → UI Re-render
```

### 2. **Data Fetching Flow**
```
Component → Feature Hook (e.g., useTournaments) → Feature Service → Supabase Client → Database
                                                                    ↓
Component ← Hook Returns Data ← Service Returns Data ← Supabase Response
```

### 3. **State Management Strategy**
- **Local State**: Component-level state via `useState` for UI-only concerns
- **Feature State**: Custom hooks encapsulate feature-specific state and logic
- **Global State**: React Context for:
  - Authentication state (user, session)
  - App-wide preferences (if needed)
- **Server State**: Supabase real-time subscriptions for live data updates

### 4. **Component Hierarchy**
```
App
├── AuthProvider (Context)
├── Router
│   ├── Public Routes
│   │   ├── Login
│   │   └── Signup
│   └── Protected Routes
│       ├── Dashboard
│       ├── Dashboard
│       ├── Tournament View
│       ├── Competition View
│       ├── Annual Leaderboard
│       └── Profile
```

## Architectural Principles

1. **Feature-Based Organization**: Group related code by feature, not by type
2. **Explicit Boundaries**: Clear separation between UI, business logic, and data access
3. **Single Responsibility**: Each module/function does one thing well
4. **Dependency Direction**: UI → Hooks → Services → Supabase (never reverse)
5. **Type Safety**: TypeScript types flow from database schema → services → hooks → components

## Domain Model Clarification

### Tournaments vs Competitions

**Tournaments** = PGA Tour golf events
- Examples: "The Masters", "PGA Championship", "U.S. Open"
- These are the actual golf tournaments happening on the PGA Tour
- Data comes from external API (PGA Tour data)
- Read-only from our app's perspective (we don't create tournaments)
- Contains: tournament name, dates, status, field (golfers), leaderboard

**Competitions** = User-created friend groups competing for a tournament
- Examples: "Eric's Masters Pool", "Weekend Warriors - PGA Championship"
- Users create these to compete with friends
- Each competition is tied to one tournament
- Contains: competition name, creator, participants, picks, scores
- This is where users make their golfer picks and compete

**Relationship**: One Tournament → Many Competitions
- Multiple friend groups can compete for the same tournament
- Each competition has its own picks and leaderboard

**Annual Leaderboard** = Aggregated results across all competitions
- Calculates cumulative scores for all users across all competitions in a year
- Shows overall rankings based on total points earned
- Updates as competitions complete
- Separate from individual competition leaderboards

## Key Architectural Decisions

### Why Feature-Based Structure?
- Easier to locate code related to a specific feature
- Better encapsulation of feature-specific logic
- Scales better as features grow
- Clearer mental model for developers

### Why React Context over Redux?
- Simpler mental model for this app's scope
- Less boilerplate
- Built-in React solution (no external dependency)
- Sufficient for auth and minimal global state needs

### Why Custom Hooks for Data Fetching?
- Encapsulates data fetching logic
- Reusable across components
- Easy to add loading/error states
- Can be tested independently

### Why Services Layer?
- Centralizes Supabase client usage
- Single source of truth for data transformations
- Easier to mock for testing
- Clear boundary between UI and data layer
- **Critical for caching**: Services layer is where we implement API rate limit management

