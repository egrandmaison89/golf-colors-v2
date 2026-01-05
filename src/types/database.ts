/**
 * Database Types
 * 
 * TypeScript types generated from Supabase database schema.
 * These types should match the database schema exactly.
 * 
 * To regenerate: Use Supabase CLI or manually update when schema changes.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      golfers: {
        Row: {
          id: string;
          sportsdata_id: string;
          first_name: string;
          last_name: string;
          display_name: string;
          headshot_url: string | null;
          country: string | null;
          world_ranking: number | null;
          last_updated: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sportsdata_id: string;
          first_name: string;
          last_name: string;
          display_name: string;
          headshot_url?: string | null;
          country?: string | null;
          world_ranking?: number | null;
          last_updated?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          sportsdata_id?: string;
          first_name?: string;
          last_name?: string;
          display_name?: string;
          headshot_url?: string | null;
          country?: string | null;
          world_ranking?: number | null;
          last_updated?: string;
          created_at?: string;
        };
      };
      tournaments: {
        Row: {
          id: string;
          sportsdata_id: string;
          name: string;
          start_date: string;
          end_date: string;
          status: 'upcoming' | 'active' | 'completed';
          course_name: string | null;
          purse: number | null;
          last_updated: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sportsdata_id: string;
          name: string;
          start_date: string;
          end_date: string;
          status: 'upcoming' | 'active' | 'completed';
          course_name?: string | null;
          purse?: number | null;
          last_updated?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          sportsdata_id?: string;
          name?: string;
          start_date?: string;
          end_date?: string;
          status?: 'upcoming' | 'active' | 'completed';
          course_name?: string | null;
          purse?: number | null;
          last_updated?: string;
          created_at?: string;
        };
      };
      tournament_results: {
        Row: {
          id: string;
          tournament_id: string;
          golfer_id: string;
          position: number | null;
          total_score: number | null;
          total_to_par: number | null;
          rounds: Json | null;
          earnings: number | null;
          made_cut: boolean | null;
          withdrew: boolean | null;
          last_updated: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          golfer_id: string;
          position?: number | null;
          total_score?: number | null;
          total_to_par?: number | null;
          rounds?: Json | null;
          earnings?: number | null;
          made_cut?: boolean | null;
          withdrew?: boolean | null;
          last_updated?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          golfer_id?: string;
          position?: number | null;
          total_score?: number | null;
          total_to_par?: number | null;
          rounds?: Json | null;
          earnings?: number | null;
          made_cut?: boolean | null;
          withdrew?: boolean | null;
          last_updated?: string;
          created_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          venmo_link: string | null;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          venmo_link?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          venmo_link?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      competitions: {
        Row: {
          id: string;
          tournament_id: string;
          name: string;
          created_by: string;
          draft_status: 'not_started' | 'in_progress' | 'completed' | 'canceled';
          draft_started_at: string | null;
          draft_completed_at: string | null;
          pick_deadline: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          name: string;
          created_by: string;
          draft_status?: 'not_started' | 'in_progress' | 'completed' | 'canceled';
          draft_started_at?: string | null;
          draft_completed_at?: string | null;
          pick_deadline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          name?: string;
          created_by?: string;
          draft_status?: 'not_started' | 'in_progress' | 'completed' | 'canceled';
          draft_started_at?: string | null;
          draft_completed_at?: string | null;
          pick_deadline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      competition_participants: {
        Row: {
          id: string;
          competition_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          competition_id?: string;
          user_id?: string;
          joined_at?: string;
        };
      };
      draft_order: {
        Row: {
          id: string;
          competition_id: string;
          user_id: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          user_id: string;
          position: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          competition_id?: string;
          user_id?: string;
          position?: number;
          created_at?: string;
        };
      };
      draft_picks: {
        Row: {
          id: string;
          competition_id: string;
          user_id: string;
          golfer_id: string;
          draft_round: 1 | 2 | 3;
          pick_number: number;
          picked_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          user_id: string;
          golfer_id: string;
          draft_round: 1 | 2 | 3;
          pick_number: number;
          picked_at?: string;
        };
        Update: {
          id?: string;
          competition_id?: string;
          user_id?: string;
          golfer_id?: string;
          draft_round?: 1 | 2 | 3;
          pick_number?: number;
          picked_at?: string;
        };
      };
      alternates: {
        Row: {
          id: string;
          competition_id: string;
          user_id: string;
          golfer_id: string;
          selected_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          user_id: string;
          golfer_id: string;
          selected_at?: string;
        };
        Update: {
          id?: string;
          competition_id?: string;
          user_id?: string;
          golfer_id?: string;
          selected_at?: string;
        };
      };
      competition_scores: {
        Row: {
          id: string;
          competition_id: string;
          user_id: string;
          team_score_strokes: number;
          team_score_to_par: number;
          final_position: number | null;
          score_breakdown: Json | null;
          calculated_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          user_id: string;
          team_score_strokes: number;
          team_score_to_par: number;
          final_position?: number | null;
          score_breakdown?: Json | null;
          calculated_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          competition_id?: string;
          user_id?: string;
          team_score_strokes?: number;
          team_score_to_par?: number;
          final_position?: number | null;
          score_breakdown?: Json | null;
          calculated_at?: string;
          updated_at?: string;
        };
      };
      competition_payments: {
        Row: {
          id: string;
          competition_id: string;
          from_user_id: string;
          to_user_id: string;
          amount: number;
          payment_type: 'main_competition' | 'bounty';
          created_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          from_user_id: string;
          to_user_id: string;
          amount: number;
          payment_type: 'main_competition' | 'bounty';
          created_at?: string;
        };
        Update: {
          id?: string;
          competition_id?: string;
          from_user_id?: string;
          to_user_id?: string;
          amount?: number;
          payment_type?: 'main_competition' | 'bounty';
          created_at?: string;
        };
      };
      competition_bounties: {
        Row: {
          id: string;
          competition_id: string;
          user_id: string;
          golfer_id: string;
          pick_round: 1 | 2 | 3;
          bounty_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          user_id: string;
          golfer_id: string;
          pick_round: 1 | 2 | 3;
          bounty_amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          competition_id?: string;
          user_id?: string;
          golfer_id?: string;
          pick_round?: 1 | 2 | 3;
          bounty_amount?: number;
          created_at?: string;
        };
      };
      annual_leaderboard: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          total_competitions: number;
          competitions_won: number;
          total_winnings: number;
          calculated_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          year: number;
          total_competitions?: number;
          competitions_won?: number;
          total_winnings?: number;
          calculated_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          year?: number;
          total_competitions?: number;
          competitions_won?: number;
          total_winnings?: number;
          calculated_at?: string;
          updated_at?: string;
        };
      };
      api_usage: {
        Row: {
          id: string;
          endpoint: string;
          data_type: string;
          day: string;
          timestamp: string;
        };
        Insert: {
          id?: string;
          endpoint: string;
          data_type: string;
          day: string;
          timestamp?: string;
        };
        Update: {
          id?: string;
          endpoint?: string;
          data_type?: string;
          day?: string;
          timestamp?: string;
        };
      };
    };
  };
}

// Convenience type exports
export type Golfer = Database['public']['Tables']['golfers']['Row'];
export type Tournament = Database['public']['Tables']['tournaments']['Row'];
export type TournamentResult = Database['public']['Tables']['tournament_results']['Row'];
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type Competition = Database['public']['Tables']['competitions']['Row'];
export type CompetitionParticipant = Database['public']['Tables']['competition_participants']['Row'];
export type DraftOrder = Database['public']['Tables']['draft_order']['Row'];
export type DraftPick = Database['public']['Tables']['draft_picks']['Row'];
export type Alternate = Database['public']['Tables']['alternates']['Row'];
export type CompetitionScore = Database['public']['Tables']['competition_scores']['Row'];
export type CompetitionPayment = Database['public']['Tables']['competition_payments']['Row'];
export type CompetitionBounty = Database['public']['Tables']['competition_bounties']['Row'];
export type AnnualLeaderboard = Database['public']['Tables']['annual_leaderboard']['Row'];
export type ApiUsage = Database['public']['Tables']['api_usage']['Row'];

