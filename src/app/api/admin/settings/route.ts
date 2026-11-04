import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, readBody, requireAdmin, jsonOk, logAdminAction } from "@/lib/api-utils";
import { adminSettingsSchema } from "@/lib/validators";

/** Paramètres généraux du site (aucun secret de paiement n'y est exposé) */
export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    // Bascule Supabase : site_settings.setting_key / setting_value
    const settings = await db.siteSetting.findMany();
    return jsonOk({
      settings: Object.fromEntries(settings.map((s) => [s.settingKey, s.settingValue])),
    });
  });
}

/** Mise à jour des paramètres */
export async function PUT(req: NextRequest) {
  return handleRoute(async () => {
    const admin = await requireAdmin();
    const input = await readBody(req, adminSettingsSchema);

    const entries = Object.entries(input.settings);
    for (const [key, value] of entries) {
      await db.siteSetting.upsert({
        where: { settingKey: key },
        create: { settingKey: key, settingValue: value },
        update: { settingValue: value },
      });
    }

    await logAdminAction(
      admin.id,
      "SETTINGS_UPDATE",
      "SITE_SETTING",
      undefined,
      `Clés : ${entries.map(([k]) => k).join(", ")}`
    );

    const settings = await db.siteSetting.findMany();
    return jsonOk({
      settings: Object.fromEntries(settings.map((s) => [s.settingKey, s.settingValue])),
      message: "Paramètres enregistrés",
    });
  });
}
