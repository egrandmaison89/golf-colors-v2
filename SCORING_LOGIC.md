# Scoring Logic Documentation

## Overview

This document defines the complete scoring system for Golf Colors v2, including draft mechanics, team scoring, edge cases, wagering, and bounties.

## Draft System

### Basic Rules
- **Players per team**: 3 (required)
- **Alternate**: 1 (optional, selected after draft)
- **Constraint**: No two users can select the same player in a competition
- **Draft type**: Snake draft (order reverses each round)

### Draft Order
- Determined by **prior tournament results** in the same competition group
- Winner of previous tournament picks first
- Second place picks second, and so on
- Last place picks last (but gets two picks in a row due to snake draft)

### Draft Process
- **Timing**: Untimed, happens over several days before tournament starts
- **Trigger**: Once tournament field is set
- **Notifications**: SMS and Email when:
  - Draft starts
  - It's your turn to pick
  - Draft completes

### Snake Draft Example (5 users, 3 rounds)
```
Round 1: User1, User2, User3, User4, User5
Round 2: User5, User4, User3, User2, User1  (reversed)
Round 3: User1, User2, User3, User4, User5   (reversed again)
```

## Team Score Calculation

### Normal Case
- **Team Score** = Sum of final scores from all 3 drafted players
- Uses **both**:
  - Total strokes (absolute)
  - Relative to par (for comparison/display)
- **Winner**: Lowest team score (relative to par)

### Edge Cases

#### 1. Missed Cut
- Player doesn't make the cut after 2 rounds
- **Final Score** = 2 × (score relative to par from first 2 rounds)
- Example: Cut is +3, player scores +5 after 2 rounds → Final score = +10
- This score is included in Team Score

#### 2. Withdrawal (with alternate)
- If a drafted player withdraws, use alternate's score
- Alternate score calculated using same logic (normal, missed cut, etc.)
- Team Score = Sum of 2 remaining drafted players + alternate

#### 3. Withdrawal (no alternate OR multiple withdrawals)
- If user has no alternate, or needs more than alternate can provide:
- **Replacement Score** = 1 stroke higher than the highest final score of any drafted player in the competition
- Example: Highest drafted player score is +8 → Replacement = +9
- This ensures withdrawn players score worse than missed cuts

## Wagering System

### Main Competition
- **Winner**: User with lowest Team Score
- **Losers**: All other users
- **Payment**: Each losing team pays winner $1 per stroke they lost by
- Example: Winner at -5, Loser at +3 → Loser pays $8

### Bounties (Separate Prize)
- **Trigger**: User selects the tournament winner (1st place finisher)
- **Prize Amount**:
  - $10 if winner was selected with 1st pick
  - $20 if winner was selected with 2nd pick
  - $30 if winner was selected with 3rd pick
- **Paid by**:
  - $10 bounty: Last place team pays $10
  - $20 bounty: Last 2 teams each pay $10 ($10 from each)
  - $30 bounty: Last 3 teams each pay $10 ($10 from each)
- **Independent**: Bounty can be won even if team doesn't win competition

### Ties

#### Tied Winners
- Multiple teams with lowest Team Score
- **Winnings**: Split evenly among tied winners
- Example: 2 teams tie for 1st, 3 losers → Each winner gets 50% of total winnings

#### Tied Bounty Payments
- Teams tied for positions that owe bounties split the payment
- Example: 2 teams tie for last place, $10 bounty → Each pays $5

## Data Model Implications

### New Tables Needed
1. **Draft Order**: Track draft order for each competition
2. **Draft Picks**: Track picks in order (1st, 2nd, 3rd) - needed for bounty calculation
3. **Alternates**: Separate table for alternate selections
4. **Payments**: Track who owes whom (for accounting)

### Modified Tables
1. **Competitions**: 
   - `draft_status` (not_started, in_progress, completed)
   - `draft_started_at`, `draft_completed_at`
2. **Picks**: 
   - `draft_round` (1, 2, or 3)
   - `draft_position` (order within round)
3. **Competition Scores**:
   - `team_score_strokes` (total strokes)
   - `team_score_to_par` (relative to par)
   - `final_position` (for determining next draft order)

## Clarifications (Confirmed)

1. **First Tournament Draft Order**: **Random** for the very first tournament

2. **Draft Timing**: 
   - Users cannot pick out of order (must wait for their turn)
   - **If draft is not complete (aside from optional alternate selections) when tournament starts, the competition is canceled**

3. **Alternate Selection**:
   - **Yes, multiple users can select the same alternate**
   - Deadline: Before tournament starts (same as draft completion)

4. **Missed Cut Calculation**:
   - Use the player's **actual 2-round score relative to par**, then double it
   - Example: Player scores +5 relative to par after 2 rounds → Final score = +10

5. **Withdrawal Replacement**:
   - **Highest final score among ALL drafted players in the competition**
   - Replacement score = that highest score + 1 stroke

6. **Bounty Logic**:
   - If multiple users pick the same winner, each gets their own bounty based on their pick order
   - If a user picks winner with 2nd pick ($20) but finishes last (owes $10), net = $10

7. **Payment Tracking**:
   - **Track calculations only** (who owes whom, how much)
   - Users can save Venmo link in their profile
   - Venmo link displays on leaderboard if user is owed money

8. **Competition Scope**:
   - **Competitions are always within the same friend group**
   - Draft order carries forward across tournaments in the same competition group

## Implementation Considerations

### Draft State Machine
```
not_started → in_progress → completed
```

### Draft Pick Validation
- Check player not already selected
- Check it's user's turn (based on draft order)
- Check draft not completed
- Check tournament not started

### Score Calculation Flow
1. Tournament completes → Results stored
2. For each user's team:
   - Get 3 drafted players' scores
   - Handle withdrawals (use alternate if available)
   - Handle missed cuts (2x calculation)
   - Calculate team score
3. Calculate positions
4. Calculate winnings/payments
5. Calculate bounties
6. Update draft order for next tournament

### Notification System
- Need email service (SendGrid, Resend, etc.)
- Need SMS service (Twilio, etc.)
- Queue system for notifications (don't block on send)

