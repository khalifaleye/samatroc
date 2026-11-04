import { db } from "@/lib/db";
import { handleRoute, jsonOk } from "@/lib/api-utils";

/**
 * Statistiques communautaires.
 * Les chiffres affichés sont des données de démonstration clairement
 * identifiées tant que la plateforme n'est pas officiellement lancée
 * (site_settings `demo_stats_*`, cf. seed Supabase).
 */
export async function GET() {
  return handleRoute(async () => {
    const settings = await db.siteSetting.findMany({
      where: { settingKey: { in: ["demo_stats_users", "demo_stats_listings", "demo_stats_exchanges"] } },
    });
    const get = (key: string, def: number) => {
      const v = parseInt(settings.find((s) => s.settingKey === key)?.settingValue ?? "", 10);
      return Number.isFinite(v) ? v : def;
    };

    const [realUsers, realListings, realExchanges] = await Promise.all([
      db.profile.count({ where: { role: "USER" } }),
      db.listing.count({ where: { status: "PUBLISHED" } }),
      db.exchangeProposal.count({ where: { status: "COMPLETED" } }),
    ]);

    return jsonOk({
      stats: {
        users: get("demo_stats_users", 1250),
        listings: get("demo_stats_listings", 3480),
        exchanges: get("demo_stats_exchanges", 2150),
        isDemo: true,
      },
      real: { users: realUsers, listings: realListings, exchanges: realExchanges },
    });
  });
}
