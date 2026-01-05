# features/

Feature-based organization. Each feature is self-contained with its own components, hooks, services, and types.

## Feature Structure

Each feature follows this pattern:
```
feature-name/
├── components/    # Feature-specific UI components
├── hooks/         # Custom hooks for this feature
├── services/      # Data fetching and API calls
└── types.ts       # TypeScript types for this feature
```

## Features

- **auth/**: Authentication (login, signup, session management)
- **tournaments/**: PGA Tour tournaments (schedules, fields, leaderboards)
- **golfers/**: Golfer data (profiles, rankings, stats)
- **competitions/**: User-created competition groups (picks, leaderboards)
- **leaderboard/**: Annual leaderboard (aggregated results across all competitions)
