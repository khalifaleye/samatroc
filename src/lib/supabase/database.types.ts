/**
 * Types TypeScript de la base SamaTroc (PostgreSQL / Supabase)
 * ------------------------------------------------------------
 * Générés à partir des migrations SQL (supabase/migrations) — structure du
 * cahier des charges : profiles, categories, listings, listing_images,
 * payments, exchange_proposals, conversations, conversation_participants,
 * messages, favorites, notifications, reports, admin_logs, site_settings
 * (+ référentiels cities, site_contents).
 *
 * NB : pour une génération automatisée après création du projet réel :
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";
export type AccountStatus = "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED";
export type ItemCondition = "NEUF" | "TRES_BON" | "BON" | "SATISFAISANT";
export type ListingStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED"
  | "INACTIVE"
  | "EXCHANGED"
  | "DELETED";
export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCESSFUL"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";
export type PaymentProvider = "WAVE" | "ORANGE_MONEY" | "TEST";
export type ProposalStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "COUNTERED"
  | "CANCELLED"
  | "COMPLETED";
export type ReportStatus = "PENDING" | "RESOLVED" | "DISMISSED";

export interface Profile {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  city: string | null;
  region: string | null;
  neighborhood: string | null;
  role: UserRole;
  account_status: AccountStatus;
  phone_verified: boolean;
  show_phone: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  parent_id: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface Listing {
  id: string;
  user_id: string;
  category_id: string;
  subcategory_id: string | null;
  title: string;
  slug: string;
  reference: string;
  description: string;
  condition: ItemCondition;
  city: string;
  region: string | null;
  neighborhood: string | null;
  desired_item: string;
  desired_category_id: string | null;
  desired_multiple: boolean;
  status: ListingStatus;
  publication_fee: number;
  payment_id: string | null;
  moderation_note: string | null;
  rejection_reason: string | null;
  featured: boolean;
  views_count: number;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  image_url: string;
  storage_path: string | null;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  listing_id: string | null;
  amount: number;
  currency: "XOF";
  payment_provider: PaymentProvider;
  transaction_reference: string;
  provider_transaction_id: string | null;
  status: PaymentStatus;
  payment_method: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExchangeProposal {
  id: string;
  listing_id: string;
  proposer_id: string;
  owner_id: string;
  proposed_listing_id: string | null;
  proposed_description: string | null;
  proposed_images: Json;
  message: string | null;
  status: ProposalStatus;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  listing_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  attachment_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  listing_id: string | null;
  reported_user_id: string | null;
  reason: string;
  description: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Json | null;
  created_at: string;
}

export interface SiteSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  updated_at: string;
}

export interface City {
  id: string;
  name: string;
  region: string | null;
  is_active: boolean;
}

export interface SiteContent {
  page: string;
  title: string;
  body: string;
  updated_at: string;
}

/**
 * Shape compatible avec la convention supabase-js (Database["public"]["Tables"]).
 * Permet de typer les clients supabase-js dès maintenant ; sera remplacé par
 * la génération CLI après création du projet Supabase réel.
 */
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      categories: { Row: Category; Insert: Partial<Category>; Update: Partial<Category> };
      listings: { Row: Listing; Insert: Partial<Listing>; Update: Partial<Listing> };
      listing_images: { Row: ListingImage; Insert: Partial<ListingImage>; Update: Partial<ListingImage> };
      payments: { Row: Payment; Insert: Partial<Payment>; Update: Partial<Payment> };
      exchange_proposals: {
        Row: ExchangeProposal;
        Insert: Partial<ExchangeProposal>;
        Update: Partial<ExchangeProposal>;
      };
      conversations: { Row: Conversation; Insert: Partial<Conversation>; Update: Partial<Conversation> };
      conversation_participants: {
        Row: ConversationParticipant;
        Insert: Partial<ConversationParticipant>;
        Update: Partial<ConversationParticipant>;
      };
      messages: { Row: Message; Insert: Partial<Message>; Update: Partial<Message> };
      favorites: { Row: Favorite; Insert: Partial<Favorite>; Update: Partial<Favorite> };
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> };
      reports: { Row: Report; Insert: Partial<Report>; Update: Partial<Report> };
      admin_logs: { Row: AdminLog; Insert: Partial<AdminLog>; Update: Partial<AdminLog> };
      site_settings: { Row: SiteSetting; Insert: Partial<SiteSetting>; Update: Partial<SiteSetting> };
      cities: { Row: City; Insert: Partial<City>; Update: Partial<City> };
      site_contents: { Row: SiteContent; Insert: Partial<SiteContent>; Update: Partial<SiteContent> };
    };
    Views: {
      profiles_public: {
        Row: Pick<
          Profile,
          "id" | "full_name" | "username" | "avatar_url" | "city" | "region" | "neighborhood" | "show_phone" | "created_at"
        >;
      };
    };
    Functions: {
      create_listing: Record<string, unknown>;
      update_listing: Record<string, unknown>;
      delete_listing: Record<string, unknown>;
      publish_listing: Record<string, unknown>;
      create_payment: Record<string, unknown>;
      verify_payment: Record<string, unknown>;
      create_exchange_proposal: Record<string, unknown>;
      respond_to_exchange: Record<string, unknown>;
      create_conversation: Record<string, unknown>;
      send_message: Record<string, unknown>;
      mark_messages_read: Record<string, unknown>;
      mark_notification_read: Record<string, unknown>;
      add_favorite: Record<string, unknown>;
      remove_favorite: Record<string, unknown>;
      report_listing: Record<string, unknown>;
      moderate_listing: Record<string, unknown>;
      resolve_report: Record<string, unknown>;
      admin_stats: Record<string, unknown>;
      setup_first_super_admin: Record<string, unknown>;
      reactivate_own_listing: Record<string, unknown>;
    };
    Enums: {
      user_role: UserRole;
      account_status: AccountStatus;
      item_condition: ItemCondition;
      listing_status: ListingStatus;
      payment_status: PaymentStatus;
      payment_provider: PaymentProvider;
      proposal_status: ProposalStatus;
      report_status: ReportStatus;
    };
  };
};
