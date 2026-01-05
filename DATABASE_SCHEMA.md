# Database Schema Design

## Overview

This schema supports:
- User authentication (via Supabase Auth)
- Tournament data (from sportsdata.io API, cached in Supabase)
- Golfer data (from sportsdata.io API, cached in Supabase)
- User-created competitions with draft system
- Draft picks with order tracking (for bounties)
- Alternate selections
- Team score calculations
- Payment/bounty tracking
- Annual leaderboard (aggregated across all competitions)
- User profiles with Venmo links

## Tables

### `golfers`
Stores golfer information from sportsdata.io API.

```sql
CREATE TABLE golfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sportsdata_id TEXT UNIQUE NOT NULL, -- External API ID
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  display_name TEXT NOT NULL, -- "Tiger Woods"
  headshot_url TEXT,
  country TEXT,
  world_ranking INTEGER,
  -- Caching metadata
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_golfers_sportsdata_id ON golfers(sportsdata_id);
CREATE INDEX idx_golfers_world_ranking ON golfers(world_ranking);
```

### `tournaments`
Stores tournament information from sportsdata.io API.

```sql
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sportsdata_id TEXT UNIQUE NOT NULL, -- External API ID
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL, -- 'upcoming', 'active', 'completed'
  course_name TEXT,
  purse DECIMAL(12, 2), -- Prize money
  -- Caching metadata
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tournaments_sportsdata_id ON tournaments(sportsdata_id);
CREATE INDEX idx_tournaments_dates ON tournaments(start_date, end_date);
CREATE INDEX idx_tournaments_status ON tournaments(status);
```

### `tournament_results`
Stores leaderboard/scores for tournaments (from sportsdata.io API).

```sql
CREATE TABLE tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  golfer_id UUID NOT NULL REFERENCES golfers(id) ON DELETE CASCADE,
  position INTEGER, -- Final position (1, 2, 3, etc.)
  total_score INTEGER, -- Total strokes
  total_to_par INTEGER, -- Score relative to par (-5, +2, etc.)
  rounds JSONB, -- Array of round scores [{round: 1, score: 68, to_par: -2}, ...]
  earnings DECIMAL(12, 2), -- Prize money earned
  made_cut BOOLEAN, -- Did player make the cut?
  withdrew BOOLEAN, -- Did player withdraw?
  -- Caching metadata
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, golfer_id)
);

CREATE INDEX idx_tournament_results_tournament ON tournament_results(tournament_id);
CREATE INDEX idx_tournament_results_golfer ON tournament_results(golfer_id);
CREATE INDEX idx_tournament_results_position ON tournament_results(tournament_id, position);
```

### `user_profiles`
Extended user profile information (extends Supabase auth.users).

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  venmo_link TEXT, -- User's Venmo profile link
  display_name TEXT, -- Optional display name
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_venmo ON user_profiles(venmo_link) WHERE venmo_link IS NOT NULL;
```

### `competitions`
User-created competition groups for tournaments.

```sql
CREATE TABLE competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Draft status
  draft_status TEXT NOT NULL DEFAULT 'not_started', -- 'not_started', 'in_progress', 'completed', 'canceled'
  draft_started_at TIMESTAMPTZ,
  draft_completed_at TIMESTAMPTZ,
  -- Competition settings
  pick_deadline TIMESTAMPTZ, -- When picks must be submitted by (tournament start)
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competitions_tournament ON competitions(tournament_id);
CREATE INDEX idx_competitions_created_by ON competitions(created_by);
CREATE INDEX idx_competitions_draft_status ON competitions(draft_status);
```

### `competition_participants`
Junction table for users participating in competitions.

```sql
CREATE TABLE competition_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, user_id)
);

CREATE INDEX idx_participants_competition ON competition_participants(competition_id);
CREATE INDEX idx_participants_user ON competition_participants(user_id);
```

### `draft_order`
Tracks draft order for each competition (determines who picks when).

```sql
CREATE TABLE draft_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, -- 1 = first pick, 2 = second pick, etc.
  -- For first tournament: position is random
  -- For subsequent tournaments: position based on prior tournament results
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, user_id),
  UNIQUE(competition_id, position)
);

CREATE INDEX idx_draft_order_competition ON draft_order(competition_id);
CREATE INDEX idx_draft_order_competition_position ON draft_order(competition_id, position);
```

### `draft_picks`
Tracks draft picks with order (needed for bounty calculation).

```sql
CREATE TABLE draft_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  golfer_id UUID NOT NULL REFERENCES golfers(id) ON DELETE CASCADE,
  draft_round INTEGER NOT NULL, -- 1, 2, or 3 (which round of the draft)
  pick_number INTEGER NOT NULL, -- Overall pick number (1, 2, 3, ...)
  -- Snake draft: Round 1 goes 1->N, Round 2 goes N->1, Round 3 goes 1->N
  picked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, golfer_id), -- No two users can pick same golfer
  UNIQUE(competition_id, user_id, draft_round) -- User can only pick once per round
);

CREATE INDEX idx_draft_picks_competition ON draft_picks(competition_id);
CREATE INDEX idx_draft_picks_user ON draft_picks(user_id);
CREATE INDEX idx_draft_picks_competition_user ON draft_picks(competition_id, user_id);
CREATE INDEX idx_draft_picks_pick_number ON draft_picks(competition_id, pick_number);
```

### `alternates`
Alternate selections (4th player, used if a drafted player withdraws).

```sql
CREATE TABLE alternates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  golfer_id UUID NOT NULL REFERENCES golfers(id) ON DELETE CASCADE,
  selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, user_id) -- One alternate per user per competition
  -- Note: Multiple users CAN select the same alternate
);

CREATE INDEX idx_alternates_competition ON alternates(competition_id);
CREATE INDEX idx_alternates_user ON alternates(user_id);
```

### `competition_scores`
Calculated team scores for users in competitions.

```sql
CREATE TABLE competition_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Team scores
  team_score_strokes INTEGER NOT NULL, -- Total strokes (sum of 3 players)
  team_score_to_par INTEGER NOT NULL, -- Total relative to par (sum of 3 players)
  final_position INTEGER, -- 1 = winner, 2 = second, etc. (for next draft order)
  -- Score breakdown (for transparency/debugging)
  score_breakdown JSONB, -- {
  --   "player1": {golfer_id, score, to_par, used_alternate: false},
  --   "player2": {...},
  --   "player3": {...}
  -- }
  -- Metadata
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, user_id)
);

CREATE INDEX idx_scores_competition ON competition_scores(competition_id);
CREATE INDEX idx_scores_user ON competition_scores(user_id);
CREATE INDEX idx_scores_competition_position ON competition_scores(competition_id, final_position);
CREATE INDEX idx_scores_competition_to_par ON competition_scores(competition_id, team_score_to_par);
```

### `competition_payments`
Tracks payment calculations (who owes whom, how much).

```sql
CREATE TABLE competition_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL, -- Amount owed (always positive)
  payment_type TEXT NOT NULL, -- 'main_competition' or 'bounty'
  -- For main competition: $1 per stroke lost by
  -- For bounty: $10 per position (last place pays $10, last 2 pay $10 each, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, from_user_id, to_user_id, payment_type)
);

CREATE INDEX idx_payments_competition ON competition_payments(competition_id);
CREATE INDEX idx_payments_from_user ON competition_payments(from_user_id);
CREATE INDEX idx_payments_to_user ON competition_payments(to_user_id);
```

### `competition_bounties`
Tracks bounty winners and amounts.

```sql
CREATE TABLE competition_bounties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  golfer_id UUID NOT NULL REFERENCES golfers(id) ON DELETE CASCADE, -- Tournament winner
  pick_round INTEGER NOT NULL, -- Which round they picked the winner (1, 2, or 3)
  bounty_amount DECIMAL(10, 2) NOT NULL, -- $10, $20, or $30
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, user_id, golfer_id) -- User can only win one bounty per competition
);

CREATE INDEX idx_bounties_competition ON competition_bounties(competition_id);
CREATE INDEX idx_bounties_user ON competition_bounties(user_id);
```

### `annual_leaderboard`
Pre-calculated annual leaderboard (for performance).

```sql
CREATE TABLE annual_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL, -- 2025, 2026, etc.
  total_competitions INTEGER NOT NULL DEFAULT 0,
  competitions_won INTEGER NOT NULL DEFAULT 0,
  total_winnings DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Net winnings (wins - losses)
  -- Metadata
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, year)
);

CREATE INDEX idx_annual_leaderboard_year ON annual_leaderboard(year, total_winnings DESC);
CREATE INDEX idx_annual_leaderboard_user ON annual_leaderboard(user_id);
```

### `api_usage`
Track API calls to sportsdata.io (for rate limit management).

```sql
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL, -- Which API endpoint was called
  data_type TEXT NOT NULL, -- 'tournament', 'golfer', 'leaderboard', etc.
  day DATE NOT NULL, -- For daily aggregation
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_usage_day ON api_usage(day);
CREATE INDEX idx_api_usage_timestamp ON api_usage(timestamp);
```

## Row Level Security (RLS) Policies

### `user_profiles`
- Users can read all profiles (for Venmo links on leaderboard)
- Users can update their own profile

### `competitions`
- Users can read competitions they're participants in
- Users can create competitions
- Competition creators can update/delete their competitions

### `competition_participants`
- Users can read participants for competitions they're in
- Users can join competitions (insert)
- Competition creators can see all participants

### `draft_order`
- Users can read draft order for competitions they're in

### `draft_picks`
- Users can read picks for competitions they're in
- Users can create their own picks (when it's their turn)
- Users cannot update/delete picks after tournament starts

### `alternates`
- Users can read alternates for competitions they're in
- Users can create/update their own alternate (before tournament starts)

### `competition_scores`
- Users can read scores for competitions they're in

### `competition_payments`
- Users can read payments for competitions they're in

### `competition_bounties`
- Users can read bounties for competitions they're in

### `annual_leaderboard`
- All authenticated users can read (public leaderboard)

### `golfers`, `tournaments`, `tournament_results`
- All authenticated users can read (public data)

## Scoring Logic

See `SCORING_LOGIC.md` for complete scoring rules.

### Key Points:
- Team Score = Sum of 3 drafted players' final scores
- Missed cut: 2x (player's 2-round score relative to par)
- Withdrawal: Use alternate if available, else replacement score
- Winner: Lowest team score (relative to par)
- Payments: $1 per stroke lost by
- Bounties: $10/$20/$30 based on pick round

## Notes

1. **Caching Strategy**: `last_updated` fields track when data was fetched from API
2. **Draft Constraints**: Enforced via UNIQUE constraints (no duplicate picks, one pick per round)
3. **Performance**: Indexes created for common query patterns
4. **Data Integrity**: Foreign keys ensure referential integrity
5. **Venmo Links**: Stored in user_profiles, displayed on leaderboard when user is owed money

## Migration Strategy

1. Create tables in order (respecting foreign key dependencies)
2. Set up RLS policies
3. Create indexes
4. Set up triggers for `updated_at` timestamps
5. Seed initial data (if needed)
