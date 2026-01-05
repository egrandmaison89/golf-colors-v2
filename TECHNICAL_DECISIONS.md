# Technical Decisions Document

## What Was Wrong with v1

### 1. **Inconsistent Architecture**
- Mixed organizational patterns (some by type, some by feature)
- Unclear where to find code related to a specific feature
- Difficult to understand the system's structure at a glance

### 2. **Messy State Management**
- State scattered across components without clear patterns
- Unclear data flow (where does data come from? where does it go?)
- Difficult to trace state changes and debug issues

### 3. **Poor Separation of Concerns**
- Business logic mixed with UI components
- Data fetching logic duplicated across components
- No clear boundaries between layers

### 4. **Minimal Documentation**
- No explanation of architectural decisions
- Unclear why certain patterns were chosen
- Difficult for new developers (or future you) to understand the codebase

### 5. **Type Safety Issues**
- Likely minimal or inconsistent TypeScript usage
- Runtime errors that could have been caught at compile time
- Unclear data shapes throughout the app

## What's Different in v2

### 1. **Feature-Based Architecture**
**Decision**: Organize code by feature, not by technical layer.

**Why**: 
- Easier mental model: "I need to work on tournaments → go to `features/tournaments/`"
- Better encapsulation: all tournament-related code lives together
- Scales better: adding a new feature doesn't require touching multiple directories

**Tradeoff**: 
- Some duplication of common patterns (acceptable for clarity)
- Requires discipline to maintain boundaries (mitigated by clear folder structure)

### 2. **Explicit Service Layer**
**Decision**: Create a services layer that wraps Supabase client calls.

**Why**:
- Single source of truth for data transformations
- Easier to change data source later if needed
- Clear boundary: components never directly import Supabase client
- Easier to add caching, error handling, or logging in one place

**Tradeoff**:
- Slight indirection (component → hook → service → Supabase)
- More files to maintain (worth it for clarity and testability)

### 3. **Custom Hooks for Data Fetching**
**Decision**: Encapsulate data fetching in custom hooks (e.g., `useTournaments`, `useGolfers`).

**Why**:
- Reusable across components
- Encapsulates loading/error states
- Can be tested independently
- Follows React best practices

**Tradeoff**:
- More abstraction layers (acceptable for maintainability)
- Requires understanding of React hooks (standard React pattern)

### 4. **React Context for Global State**
**Decision**: Use React Context API instead of Redux or Zustand.

**Why**:
- Built into React (no external dependency)
- Sufficient for our needs (auth state + minimal global state)
- Simpler mental model
- Less boilerplate

**Tradeoff**:
- Less powerful than Redux for complex state management
- Can cause unnecessary re-renders if not careful (mitigated by splitting contexts)
- **Acceptable because**: Our global state needs are minimal (auth + maybe user preferences)

### 5. **TypeScript Throughout**
**Decision**: Strict TypeScript with proper types flowing from database → services → hooks → components.

**Why**:
- Catch errors at compile time
- Better IDE autocomplete
- Self-documenting code
- Easier refactoring

**Tradeoff**:
- Slightly more verbose (worth it for safety and clarity)
- Initial setup time (one-time cost)

### 6. **Vite Instead of Create React App**
**Decision**: Use Vite as the build tool.

**Why**:
- Faster development server
- Better TypeScript support out of the box
- Modern tooling
- Smaller bundle sizes

**Tradeoff**:
- Different from CRA (learning curve, but minimal)
- **Note**: v1 may have used Vite already (checking package.json)

### 7. **Explicit Error Handling**
**Decision**: Handle errors explicitly at each layer with clear error states.

**Why**:
- Better user experience (users see helpful error messages)
- Easier debugging (errors are caught and logged appropriately)
- Production-ready behavior

**Tradeoff**:
- More code to write (worth it for reliability)

### 8. **Environment Variable Management**
**Decision**: Use `.env.local` for local development, `.env.example` for documentation.

**Why**:
- Clear separation of secrets vs. configuration
- Easy onboarding (new developers see what's needed)
- Prevents accidental commits of secrets

**Tradeoff**:
- Requires discipline to keep `.env.local` out of git (handled by `.gitignore`)

### 9. **Strategic Caching for API Rate Limits**
**Decision**: Multi-layer caching strategy with Supabase as persistent cache.

**Why**:
- v1 hit API rate limits (1000 free lookups/day)
- Database-first approach: store API data in Supabase, refresh strategically
- Reduces API calls by 90%+ (most requests served from cache)
- Stale data is acceptable for most use cases

**Implementation**:
- Layer 1: In-memory cache (React state) - session-based
- Layer 2: Supabase database cache - persistent, with refresh intervals
- Layer 3: External API - only when cache is stale or missing

**Refresh Strategy**:
- Upcoming tournaments: 24 hours
- Active tournaments: 5 minutes (frequent leaderboard updates)
- Completed tournaments: Never (historical data)
- Golfer data: 7 days

**Tradeoff**:
- Slightly stale data possible (acceptable tradeoff)
- More complex service layer (worth it for rate limit management)
- Database storage for API data (minimal cost, significant benefit)

See `CACHING_STRATEGY.md` for detailed implementation plan.

## Tradeoffs Explicitly Acknowledged

### 1. **Simplicity vs. Scalability**
- **Chosen**: Simpler patterns (Context API, custom hooks)
- **Tradeoff**: May need to refactor if app grows significantly
- **Mitigation**: Clear architecture makes refactoring easier

### 2. **Feature-Based vs. Layer-Based**
- **Chosen**: Feature-based organization
- **Tradeoff**: Some duplication of common patterns
- **Mitigation**: Shared utilities in `lib/utils/` for truly common code

### 3. **No State Management Library**
- **Chosen**: React Context + custom hooks
- **Tradeoff**: Less powerful than Redux/Zustand
- **Mitigation**: Sufficient for current needs; can add library later if needed

### 4. **Supabase Client in Services**
- **Chosen**: Services layer wraps Supabase
- **Tradeoff**: Extra indirection
- **Mitigation**: Clear benefits (testability, maintainability) outweigh cost

### 5. **TypeScript Strictness**
- **Chosen**: Strict TypeScript
- **Tradeoff**: More verbose, slower initial development
- **Mitigation**: Long-term maintainability and fewer bugs

## What We're NOT Doing (And Why)

### 1. **No Redux/Zustand**
- **Why**: Overkill for our state needs. Context + hooks is sufficient.

### 2. **No GraphQL**
- **Why**: Supabase REST API is sufficient. No need for additional complexity.

### 3. **No Micro-Frontends**
- **Why**: Single app, single team. Monolith is appropriate here.

### 4. **No Server-Side Rendering (Next.js)**
- **Why**: Not needed for this app. Static deployment is simpler and sufficient.

### 5. **No Complex Caching Strategy**
- **Why**: Supabase handles caching. Premature optimization.

### 6. **No Test Suite (Initially)**
- **Why**: Focus on architecture first. Tests can be added incrementally.
- **Note**: Structure supports testing (services are easily testable)

## Future Considerations (Not Now)

These are things we might add later, but not in v2:

- Unit tests for services and hooks
- E2E tests for critical flows
- Performance monitoring
- Error tracking (Sentry, etc.)
- Analytics
- Advanced caching strategies

**Why not now?**: v2 goal is architecture and maintainability. These are optimizations that can come later.

