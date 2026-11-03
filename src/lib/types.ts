/**
 * Types partagés SamaTroc (client + serveur)
 */

export interface CategoryData {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  sortOrder: number;
  count?: number;
}

export interface ImageData {
  url: string;
  isPrimary: boolean;
}

export interface OwnerData {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface ListingSummary {
  id: string;
  reference: string;
  title: string;
  description: string;
  condition: string;
  city: string;
  quartier: string | null;
  wantedText: string;
  wantedCategory: string | null;
  wantedMultiple: boolean;
  status: string;
  featured: boolean;
  viewsCount: number;
  publishedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  fees: number;
  category: { id: string; name: string; slug: string; icon: string; color: string } | null;
  images: ImageData[];
  owner: OwnerData;
  isFavorite?: boolean;
}

export interface ListingDetail extends ListingSummary {
  subcategory: { id: string; name: string; slug: string } | null;
  owner: OwnerData & {
    memberSince: string;
    listingsCount: number;
    whatsappEnabled: boolean;
    showPhone: boolean;
    phone: string | null;
  };
  isOwner: boolean;
  similar: ListingSummary[];
}

export interface ProposalData {
  id: string;
  status: string;
  message: string | null;
  counterText: string | null;
  offeredText: string | null;
  offeredImages: string[];
  createdAt: string;
  respondedAt: string | null;
  completedAt: string | null;
  listing: ListingSummary;
  offeredListing: ListingSummary | null;
  proposer: OwnerData;
  owner: OwnerData;
  direction: "sent" | "received";
}

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  body: string;
  linkView: string | null;
  linkParams: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface MessageData {
  id: string;
  senderId: string | null;
  type: string;
  content: string;
  imageUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ConversationData {
  id: string;
  listing: { id: string; title: string; images: ImageData[] } | null;
  other: OwnerData;
  lastMessage: { content: string; type: string; senderId: string | null; createdAt: string } | null;
  unreadCount: number;
  lastMessageAt: string;
}

export interface PaymentData {
  id?: string;
  reference: string;
  amount: number;
  status: string;
  provider: string;
  method?: string | null;
  phone?: string | null;
  isTest?: boolean;
  createdAt: string;
  paidAt?: string | null;
  listingId?: string | null;
  listing?: { id: string; title: string; images: ImageData[] } | null;
}

export interface Paginated<T> {
  items?: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
