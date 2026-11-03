/**
 * Supabase Realtime — souscriptions temps réel (respectent la RLS)
 * ----------------------------------------------------------------
 * Canaux fournis :
 *   • messages            → messagerie instantanée d'une conversation
 *   • notifications       → badge / toasts de l'utilisateur connecté
 *   • exchange_proposals  → propositions reçues/envoyées
 *   • listings            → changements de statut des annonces suivies
 *
 * Les filtres serveur + RLS garantissent qu'un client ne reçoit JAMAIS les
 * données d'un autre utilisateur.
 */
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

type TypedClient = SupabaseClient<Database>;

/** Messagerie : nouveaux messages d'une conversation donnée */
export function subscribeToMessages(
  supabase: TypedClient,
  conversationId: string,
  onInsert: (message: Database["public"]["Tables"]["messages"]["Row"]) => void
): RealtimeChannel {
  return supabase
    .channel(`conversation:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onInsert(payload.new as Database["public"]["Tables"]["messages"]["Row"])
    )
    .subscribe();
}

/** Notifications de l'utilisateur connecté (INSERT + marquage lu) */
export function subscribeToNotifications(
  supabase: TypedClient,
  userId: string,
  onChange: () => void
): RealtimeChannel {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      onChange
    )
    .subscribe();
}

/** Propositions d'échange me concernant (reçues ou envoyées) */
export function subscribeToExchangeProposals(
  supabase: TypedClient,
  userId: string,
  onChange: () => void
): RealtimeChannel {
  return supabase
    .channel(`proposals:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "exchange_proposals",
        filter: `owner_id=eq.${userId}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "exchange_proposals",
        filter: `proposer_id=eq.${userId}`,
      },
      onChange
    )
    .subscribe();
}

/** Changement de statut d'une annonce (paiement confirmé, modération…) */
export function subscribeToListingStatus(
  supabase: TypedClient,
  listingId: string,
  onChange: (status: string) => void
): RealtimeChannel {
  return supabase
    .channel(`listing:${listingId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "listings",
        filter: `id=eq.${listingId}`,
      },
      (payload) => onChange((payload.new as { status: string }).status)
    )
    .subscribe();
}

/** Désabonnement propre d'un canal */
export async function unsubscribe(supabase: TypedClient, channel: RealtimeChannel): Promise<void> {
  await supabase.removeChannel(channel);
}
