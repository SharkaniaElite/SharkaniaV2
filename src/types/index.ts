// src/types/index.ts
// ══════════════════════════════════════════════════════════
// SHARKANIA — TypeScript Type Definitions
// Mapped from 03-database-schema.sql
// ══════════════════════════════════════════════════════════

// ── Enums ──

export type UserRole = "player" | "club_admin" | "super_admin";
export type ClubAdminRole = "owner" | "admin" | "moderator";
export type LeagueStatus = "upcoming" | "active" | "finished";
export type ScoringType = "simple" | "complex";
export type GameType = "NLH" | "PLO" | "PLO5" | "Mixed" | "Other";
export type TournamentType =
  | "MTT"
  | "SNG"
  | "Satellite"
  | "Freeroll"
  | "Bounty"
  | "KO_Progressive";
export type TournamentStatus =
  | "scheduled"
  | "live"
  | "late_registration"
  | "completed"
  | "cancelled";
export type ClaimStatus = "pending" | "approved" | "rejected";
export type RequestStatus = "pending" | "approved" | "rejected";
export type MissionType = "daily" | "weekly" | "achievement" | "milestone";
export type AchievementRarity = "common" | "rare" | "epic" | "legendary";
export type SubscriptionPlan = "club_pro" | "league_premium" | "player_pro";
export type SubscriptionStatus = "active" | "cancelled" | "expired";
export type CreditTransactionType = "purchase" | "reward" | "spend" | "adjustment" | "refund";

// ── Entities ──

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string | null;
  country_code: string | null;
  email: string | null;
  whatsapp: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  is_verified: boolean;
  primary_nickname: string | null;
  shark_coins_balance: number;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: CreditTransactionType;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface PokerRoom {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  created_at: string;
}

export interface Club {
  id: string;
  name: string;
  country_code: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  is_approved: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClubRoom {
  id: string;
  club_id: string;
  room_id: string;
  club_room_identifier: string | null;
}

export interface ClubAdmin {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubAdminRole;
}

export interface ScoringSystem {
  id: string;
  name: string;
  description: string | null;
  type: ScoringType;
  config: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface League {
  id: string;
  name: string;
  description: string | null;
  rules_url: string | null;
  start_date: string | null;
  end_date: string | null;
  total_dates: number | null;       
  best_dates_to_count: number | null;
  status: LeagueStatus;
  scoring_system_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeagueClub {
  id: string;
  league_id: string;
  club_id: string;
  is_primary: boolean;
}

export interface LeagueRoom {
  id: string;
  league_id: string;
  room_id: string;
}

export interface Player {
  id: string;
  profile_id: string | null;
  nickname: string;
  room_id: string;
  country_code: string | null;
  elo_rating: number;
  elo_peak: number;
  total_tournaments: number;
  total_cashes: number;
  total_wins: number;
  total_prize_won: number;
  total_buy_ins_spent: number;
  created_at: string;
  updated_at: string;
}

export interface PlayerAlias {
  id: string;
  primary_player_id: string;
  alias_player_id: string;
  verified: boolean;
}

export interface Tournament {
  id: string;
  club_id: string;
  league_id: string | null;
  name: string;
  description: string | null;
  room_id: string;
  buy_in: number;
  currency: string;
  guaranteed_prize: number | null;
  actual_prize_pool: number | null;
  start_datetime: string;
  timezone: string;
  late_registration_minutes: number | null;
  late_reg_end?: string | null; // 👈 AÑADIDO: Campo calculado para el frontend
  max_players: number | null;
  game_type: GameType;
  tournament_type: TournamentType;
  status: TournamentStatus;
  results_uploaded: boolean;
  created_at: string;
  updated_at: string;
}

export interface TournamentResult {
  id: string;
  tournament_id: string;
  player_id: string;
  position: number;
  prize_won: number;
  bounties_won: number;
  elo_before: number | null;
  elo_after: number | null;
  elo_change: number | null;
  league_points_earned: number;
  created_at: string;
}

export interface EloHistory {
  id: string;
  player_id: string;
  tournament_id: string;
  elo_before: number;
  elo_after: number;
  elo_change: number;
  recorded_at: string;
}

export interface LeagueStanding {
  id: string;
  league_id: string;
  player_id: string;
  total_points: number;
  tournaments_played: number;
  best_position: number | null;
  rank_position: number | null;
  updated_at: string;
}

export interface NicknameClaim {
  id: string;
  user_id: string;
  player_id: string;
  screenshot_url: string;
  status: ClaimStatus;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface ClubRegistrationRequest {
  id: string;
  user_id: string;
  club_name: string;
  country_code: string | null;
  description: string | null;
  rooms: string[] | null;
  status: RequestStatus;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface GamificationMission {
  id: string;
  title: string;
  description: string | null;
  xp_reward: number;
  mission_type: MissionType;
  condition_type: string;
  condition_value: number;
  icon: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PlayerMission {
  id: string;
  player_id: string;
  mission_id: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
}

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  rarity: AchievementRarity;
  condition_type: string | null;
  condition_value: number | null;
  is_active: boolean;
  created_at: string;
}

export interface PlayerAchievement {
  id: string;
  player_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string | null;
}

// ── Joined / Extended types (used in UI) ──

export interface PlayerWithRoom extends Player {
  poker_rooms: Pick<PokerRoom, "name">;
  profiles?: { avatar_url: string | null };
}

export interface TournamentWithDetails extends Tournament {
  clubs: Pick<Club, "id" | "name" | "country_code">;
  leagues: Pick<League, "id" | "name"> | null;
  poker_rooms: Pick<PokerRoom, "name">;
}

export interface ClubWithRooms extends Club {
  club_rooms: Array<{
    poker_rooms: Pick<PokerRoom, "id" | "name">;
  }>;
}

export interface LeagueWithClubs extends League {
  league_clubs: Array<{
    is_primary: boolean;
    clubs: Pick<Club, "id" | "name" | "country_code">;
  }>;
  league_rooms: Array<{
    poker_rooms: Pick<PokerRoom, "id" | "name">;
  }>;
}

export interface TournamentResultWithPlayer extends TournamentResult {
  players: Pick<Player, "id" | "nickname" | "country_code">;
}

export interface LeagueStandingWithPlayer extends LeagueStanding {
  players: Pick<Player, "id" | "nickname" | "country_code" | "elo_rating">;
}

// ── Utility types ──

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchResult {
  type: "player" | "club" | "league" | "tournament";
  id: string;
  title: string;
  subtitle: string | null;
  icon: string;
}

// ── Shop & Credits ──

export type ProductCategory = "tool" | "cosmetic" | "report" | "bundle";
export type AccessType = "per_use" | "daily" | "monthly" | "permanent";

export interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  access_type: AccessType;
  price_coins: number;
  icon: string | null;
  feature_key: string;
  free_tier_description: string | null;
  premium_description: string | null;
  duration_days: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserPurchase {
  id: string;
  user_id: string;
  product_id: string;
  transaction_id: string | null;
  price_paid: number;
  access_type: AccessType;
  feature_key: string;
  granted_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UserPurchaseWithProduct extends UserPurchase {
  shop_products: Pick<ShopProduct, "name" | "icon" | "slug" | "category">;
}

export interface SpendCreditsResult {
  success: boolean;
  error?: string;
  purchase_id?: string;
  transaction_id?: string;
  coins_spent?: number;
  new_balance?: number;
  feature_key?: string;
  expires_at?: string | null;
  balance?: number;
  price?: number;
}

export interface FeatureAccess {
  has_access: boolean;
  expires_at: string | null;
  purchase_id: string | null;
}
