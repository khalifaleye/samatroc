import { db } from "@/lib/db";
import { handleRoute, jsonOk } from "@/lib/api-utils";
import { PAYMENT_PROVIDERS, PUBLICATION_FEE_DEFAULT } from "@/lib/constants";

/**
 * Configuration publique des paiements.
 * PAYMENT_MODE=TEST (défaut) : intégration en mode test clairement identifiée,
 * aucun vrai paiement n'est accepté tant que les clés prestataires ne sont pas configurées.
 */
export async function GET() {
  return handleRoute(async () => {
    // Bascule Supabase : site_settings.setting_key / setting_value
    const feeSetting = await db.siteSetting.findUnique({
      where: { settingKey: "publication_fee" },
    });
    const fee = feeSetting
      ? parseInt(feeSetting.settingValue, 10) || PUBLICATION_FEE_DEFAULT
      : PUBLICATION_FEE_DEFAULT;

    const mode = process.env.PAYMENT_MODE === "LIVE" ? "LIVE" : "TEST";
    const liveConfigured =
      !!process.env.PAYMENT_API_KEY && !!process.env.PAYMENT_WEBHOOK_SECRET;

    return jsonOk({
      mode,
      // En LIVE sans clés configurées, on reste explicitement en TEST
      effectiveMode: mode === "LIVE" && liveConfigured ? "LIVE" : "TEST",
      fee,
      currency: "FCFA",
      providers: PAYMENT_PROVIDERS.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        color: p.color,
      })),
    });
  });
}
