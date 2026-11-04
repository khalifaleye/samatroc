/**
 * Types TypeScript de la base SamaTroc (PostgreSQL / Supabase)
 * ------------------------------------------------------------
 * Générés à partir des migrations SQL (supabase/migrations) — structure du
 * cahier des charges : profiles, categories, listings, listing_images,
 * payments, exchange_proposals, conversations, conversation_participants,
 * messages, favorites, notifications, reports, admin_logs, site_settings
 * (+ référentiels cities, site_contents).
 *
 * FORMAT (supabase-js ≥ 2.100) :
 *  • chaque table expose { Row, Insert, Update, Relationships } ;
 *  • chaque fonction expose { Args, Returns } signés d'après les migrations
 *    SQL (supabase/migrations/20260101000002_functions.sql et 0003_rls.sql).
 *    C'est ce typage fort qui rend `supabase.rpc("verify_payment", { … })`
 *    vérifiable à la compilation (client admin, webhooks, modération…).
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

// Types « alias d'objet » (et non interfaces) : TypeScript leur accorde une
// signature d'index implicite, exigée par GenericTable de supabase-js.
export type Profile = {
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
};

export type Category = {
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
};

export type Listing = {
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
};

export type ListingImage = {
  id: string;
  listing_id: string;
  image_url: string;
  storage_path: string | null;
  is_primary: boolean;
  display_order: number;
  created_at: string;
};

export type Payment = {
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
};

export type ExchangeProposal = {
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
};

export type Conversation = {
  id: string;
  listing_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationParticipant = {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  attachment_url: string | null;
  is_read: boolean;
  created_at: string;
};

export type Favorite = {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type Report = {
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
};

export type AdminLog = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Json | null;
  created_at: string;
};

export type SiteSetting = {
  id: string;
  setting_key: string;
  setting_value: string;
  updated_at: string;
};

export type City = {
  id: string;
  name: string;
  region: string | null;
  is_active: boolean;
};

export type SiteContent = {
  page: string;
  title: string;
  body: string;
  updated_at: string;
};

/** Résultat de la fonction SQL admin_stats() (SETOF → tableau côté PostgREST). */
export type AdminStatsRow = {
  users_total: number;
  users_active: number;
  listings_total: number;
  listings_pending: number;
  listings_published: number;
  payments_successful: number;
  revenue_total: number;
  proposals_total: number;
  exchanges_completed: number;
  reports_pending: number;
};

/**
 * Shape compatible avec la convention supabase-js (Database["public"]["Tables"]).
 * Permet de typer les clients supabase-js ; sera remplacé par la génération CLI
 * après création du projet Supabase réel.
 */
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile>; Relationships: [] };
      categories: { Row: Category; Insert: Partial<Category>; Update: Partial<Category>; Relationships: [] };
      listings: { Row: Listing; Insert: Partial<Listing>; Update: Partial<Listing>; Relationships: [] };
      listing_images: { Row: ListingImage; Insert: Partial<ListingImage>; Update: Partial<ListingImage>; Relationships: [] };
      payments: { Row: Payment; Insert: Partial<Payment>; Update: Partial<Payment>; Relationships: [] };
      exchange_proposals: {
        Row: ExchangeProposal;
        Insert: Partial<ExchangeProposal>;
        Update: Partial<ExchangeProposal>;
        Relationships: [];
      };
      conversations: { Row: Conversation; Insert: Partial<Conversation>; Update: Partial<Conversation>; Relationships: [] };
      conversation_participants: {
        Row: ConversationParticipant;
        Insert: Partial<ConversationParticipant>;
        Update: Partial<ConversationParticipant>;
        Relationships: [];
      };
      messages: { Row: Message; Insert: Partial<Message>; Update: Partial<Message>; Relationships: [] };
      favorites: { Row: Favorite; Insert: Partial<Favorite>; Update: Partial<Favorite>; Relationships: [] };
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification>; Relationships: [] };
      reports: { Row: Report; Insert: Partial<Report>; Update: Partial<Report>; Relationships: [] };
      admin_logs: { Row: AdminLog; Insert: Partial<AdminLog>; Update: Partial<AdminLog>; Relationships: [] };
      site_settings: { Row: SiteSetting; Insert: Partial<SiteSetting>; Update: Partial<SiteSetting>; Relationships: [] };
      cities: { Row: City; Insert: Partial<City>; Update: Partial<City>; Relationships: [] };
      site_contents: { Row: SiteContent; Insert: Partial<SiteContent>; Update: Partial<SiteContent>; Relationships: [] };
    };
    Views: {
      profiles_public: {
        Row: Pick<
          Profile,
          "id" | "full_name" | "username" | "avatar_url" | "city" | "region" | "neighborhood" | "show_phone" | "created_at"
        >;
        Relationships: [];
      };
    };
    Functions: {
      create_listing: {
        Args: {
          p_title: string;
          p_description: string;
          p_category_id: string;
          p_city: string;
          p_desired_item: string;
          p_condition?: ItemCondition;
          p_subcategory_id?: string | null;
          p_region?: string | null;
          p_neighborhood?: string | null;
          p_desired_category_id?: string | null;
          p_desired_multiple?: boolean;
          p_submit_now?: boolean;
        };
        Returns: Listing;
      };
      update_listing: {
        Args: {
          p_listing_id: string;
          p_title?: string | null;
          p_description?: string | null;
          p_condition?: ItemCondition | null;
          p_city?: string | null;
          p_region?: string | null;
          p_neighborhood?: string | null;
          p_desired_item?: string | null;
          p_category_id?: string | null;
          p_subcategory_id?: string | null;
          p_desired_category_id?: string | null;
        };
        Returns: undefined;
      };
      delete_listing: { Args: { p_listing_id: string }; Returns: undefined };
      publish_listing: { Args: { p_listing_id: string; p_payment_id: string }; Returns: undefined };
      create_payment: {
        Args: { p_listing_id: string; p_provider: PaymentProvider; p_method?: string | null };
        Returns: Payment;
      };
      verify_payment: {
        Args: {
          p_transaction_reference: string;
          p_provider_transaction_id?: string | null;
          p_success?: boolean;
          p_amount_received?: number | null;
          p_currency?: string | null;
        };
        Returns: string;
      };
      create_exchange_proposal: {
        Args: {
          p_listing_id: string;
          p_proposed_listing_id?: string | null;
          p_proposed_description?: string | null;
          p_message?: string | null;
        };
        Returns: ExchangeProposal;
      };
      respond_to_exchange: {
        Args: { p_proposal_id: string; p_action: string; p_message?: string | null };
        Returns: undefined;
      };
      create_conversation: { Args: { p_listing_id: string; p_other_user_id: string }; Returns: string };
      send_message: {
        Args: { p_conversation_id: string; p_content: string; p_attachment_url?: string | null };
        Returns: Message;
      };
      mark_messages_read: { Args: { p_conversation_id: string }; Returns: undefined };
      mark_notification_read: { Args: { p_notification_id: string }; Returns: undefined };
      add_favorite: { Args: { p_listing_id: string }; Returns: undefined };
      remove_favorite: { Args: { p_listing_id: string }; Returns: undefined };
      report_listing: {
        Args: { p_listing_id: string; p_reason: string; p_description?: string | null };
        Returns: undefined;
      };
      moderate_listing: {
        Args: { p_listing_id: string; p_action: string; p_reason?: string | null };
        Returns: undefined;
      };
      resolve_report: {
        Args: { p_report_id: string; p_status: string; p_admin_notes?: string | null };
        Returns: undefined;
      };
      admin_stats: { Args: Record<PropertyKey, never>; Returns: AdminStatsRow[] };
      setup_first_super_admin: { Args: { p_email: string }; Returns: string };
      reactivate_own_listing: { Args: { p_listing_id: string }; Returns: undefined };
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
