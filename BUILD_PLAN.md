# Incremental Build Plan

## Philosophy

Build incrementally, test as we go, maintain working state at each step. Each phase should result in a runnable application (even if incomplete).

## Phase 1: Foundation (Days 1-2)

**Goal**: Set up the project structure and core infrastructure.

### 1.1 Project Initialization
- [ ] Initialize Vite + React + TypeScript project
- [ ] Configure TypeScript (strict mode)
- [ ] Set up ESLint and Prettier
- [ ] Configure path aliases (`@/` for `src/`)
- [ ] Set up folder structure (empty folders with READMEs explaining purpose)

### 1.2 Supabase Setup
- [ ] Create Supabase project (or connect to existing)
- [ ] Set up environment variables (`.env.local`, `.env.example`)
- [ ] Create Supabase client utility (`lib/supabase/client.ts`)
- [ ] Test connection

### 1.3 Basic Routing
- [ ] Install React Router
- [ ] Set up basic route structure (public/protected)
- [ ] Create layout components (Header, Footer)
- [ ] Create placeholder pages

**Deliverable**: App runs, shows basic routing, connects to Supabase.

---

## Phase 2: Authentication (Days 3-4)

**Goal**: Complete authentication flow.

### 2.1 Auth Context
- [ ] Create `AuthContext` and `AuthProvider`
- [ ] Implement auth state management (user, session, loading)
- [ ] Create `useAuth` hook

### 2.2 Auth UI
- [ ] Create login page
- [ ] Create signup page
- [ ] Create logout functionality
- [ ] Add protected route wrapper

### 2.3 Auth Integration
- [ ] Connect UI to Supabase Auth
- [ ] Handle auth state persistence
- [ ] Handle auth errors gracefully

**Deliverable**: Users can sign up, log in, log out. Protected routes work.

---

## Phase 3: Core Data Models (Days 5-6)

**Goal**: Set up database schema and TypeScript types.

### 3.1 Database Schema
- [ ] Review v1 schema (if accessible) or design from scratch
- [ ] Create tables:
  - `golfers` (id, name, headshot_url, etc.)
  - `tournaments` (id, name, date, status, etc.)
  - `competitions` (id, tournament_id, created_by, etc.)
  - `picks` (id, competition_id, user_id, golfer_id, etc.)
  - `users` (handled by Supabase Auth, extend with profile if needed)
- [ ] Set up Row Level Security (RLS) policies
- [ ] Create indexes for performance

### 3.2 TypeScript Types
- [ ] Create database types (from Supabase schema)
- [ ] Create domain types (for app logic)
- [ ] Set up type generation (if using Supabase CLI)

**Deliverable**: Database schema exists, TypeScript types match schema.

---

## Phase 4: Golfer Feature (Days 7-8)

**Goal**: Display golfers with headshots.

### 4.1 Golfer Service
- [ ] Create `features/golfers/services/golferService.ts`
- [ ] Implement `getGolfers()`, `getGolferById()`
- [ ] Handle errors and loading states

### 4.2 Golfer Hooks
- [ ] Create `useGolfers()` hook
- [ ] Create `useGolfer(id)` hook
- [ ] Handle caching (simple in-memory for now)

### 4.3 Golfer UI
- [ ] Create golfer list component
- [ ] Create golfer card component
- [ ] Display headshots (from public folder or Supabase Storage)
- [ ] Add basic styling

**Deliverable**: Can view list of golfers with headshots.

---

## Phase 5: Tournament Feature (Days 9-10)

**Goal**: Display tournaments and tournament details.

### 5.1 Tournament Service
- [ ] Create `features/tournaments/services/tournamentService.ts`
- [ ] Implement `getTournaments()`, `getTournamentById()`
- [ ] Implement `getTournamentGolfers(tournamentId)`

### 5.2 Tournament Hooks
- [ ] Create `useTournaments()` hook
- [ ] Create `useTournament(id)` hook

### 5.3 Tournament UI
- [ ] Create tournament list component
- [ ] Create tournament detail view
- [ ] Display tournament status, dates, leaderboard (if available)

**Deliverable**: Can view tournaments and tournament details.

---

## Phase 6: Competition Feature (Days 11-13)

**Goal**: Users can create and join competitions.

### 6.1 Competition Service
- [ ] Create `features/competitions/services/competitionService.ts`
- [ ] Implement:
  - `createCompetition(tournamentId, userId)`
  - `getCompetitions(userId)`
  - `getCompetitionById(id)`
  - `joinCompetition(competitionId, userId)`

### 6.2 Competition Hooks
- [ ] Create `useCompetitions()` hook
- [ ] Create `useCompetition(id)` hook
- [ ] Create `useCreateCompetition()` hook

### 6.3 Competition UI
- [ ] Create competition list (user's competitions)
- [ ] Create competition detail view
- [ ] Create "create competition" flow
- [ ] Display participants

**Deliverable**: Users can create and view competitions.

---

## Phase 7: Picks Feature (Days 14-16)

**Goal**: Users can make picks for competitions.

### 7.1 Picks Service
- [ ] Create `features/competitions/services/pickService.ts`
- [ ] Implement:
  - `makePick(competitionId, userId, golferId)`
  - `getPicks(competitionId)`
  - `getUserPicks(competitionId, userId)`
  - `updatePick(pickId, golferId)` (if allowed)

### 7.2 Picks Hooks
- [ ] Create `usePicks(competitionId)` hook
- [ ] Create `useMakePick()` hook

### 7.3 Picks UI
- [ ] Create pick selection interface
- [ ] Show available golfers
- [ ] Show current picks
- [ ] Handle pick validation (deadlines, limits, etc.)

**Deliverable**: Users can make picks for competitions.

---

## Phase 8: Scoring & Leaderboard (Days 17-19)

**Goal**: Calculate and display competition scores.

### 8.1 Scoring Logic
- [ ] Create scoring service/utility
- [ ] Implement score calculation based on tournament results
- [ ] Handle edge cases (missed cuts, withdrawals, etc.)

### 8.2 Leaderboard Service
- [ ] Create `getLeaderboard(competitionId)` service
- [ ] Sort by score
- [ ] Handle ties

### 8.3 Leaderboard UI
- [ ] Create leaderboard component
- [ ] Display rankings
- [ ] Highlight current user's position

**Deliverable**: Competition leaderboards work correctly.

---

## Phase 9: Polish & Production Readiness (Days 20-21)

**Goal**: Make it production-ready.

### 9.1 Error Handling
- [ ] Add error boundaries
- [ ] Improve error messages throughout
- [ ] Add loading states everywhere
- [ ] Handle network errors gracefully

### 9.2 UI/UX Improvements
- [ ] Consistent styling (Tailwind or similar)
- [ ] Responsive design
- [ ] Accessibility basics (ARIA labels, keyboard navigation)
- [ ] Loading skeletons

### 9.3 Environment & Deployment
- [ ] Set up production environment variables
- [ ] Configure build for production
- [ ] Test production build locally
- [ ] Deploy to Netlify (or chosen platform)

### 9.4 Documentation
- [ ] Complete README.md
- [ ] Document environment setup
- [ ] Document database schema
- [ ] Add code comments where needed (explaining "why")

**Deliverable**: Production-ready app deployed and documented.

---

## Build Order Rationale

1. **Foundation First**: Can't build features without infrastructure
2. **Auth Early**: Needed for protected features
3. **Data Models**: Types and schema inform everything else
4. **Read Features Before Write**: Golfers and tournaments are read-only, simpler
5. **Competitions Before Picks**: Need competitions to exist before making picks
6. **Scoring Last**: Depends on picks and tournament results
7. **Polish Last**: Only polish what exists

## Testing Strategy

- **Manual Testing**: Test each feature as it's built
- **Integration Testing**: Test flows end-to-end (e.g., create competition → make picks → view leaderboard)
- **No Unit Tests Initially**: Focus on architecture. Tests can be added incrementally later.

## Rollback Plan

Each phase should be committed separately. If something breaks:
1. Identify the phase where it broke
2. Revert to last working commit
3. Fix incrementally
4. Re-apply subsequent phases

## Success Criteria

v2 is complete when:
- [ ] All v1 features work in v2
- [ ] Code is organized and maintainable
- [ ] Architecture is clear and documented
- [ ] App is deployed and accessible
- [ ] README explains the system

