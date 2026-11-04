import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, readBody, ApiError, jsonOk, getClientIp } from "@/lib/api-utils";
import { contactSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Formulaire de contact — bascule Supabase : `db.user` → `db.profile`
 * (`status` → `accountStatus`), notifications écrites avec `message`
 * (ex `body`) ; `linkView` n'existe plus (dérivé du type SYSTEM à la
 * lecture → admin-dashboard).
 */

/** Formulaire de contact : notifie les administrateurs */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const input = await readBody(req, contactSchema);
    const ip = getClientIp(req);
    if (!rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000)) {
      throw new ApiError(429, "Trop de messages envoyés. Réessayez plus tard.");
    }

    const admins = await db.profile.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, accountStatus: "ACTIVE" },
      select: { id: true },
    });

    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: "SYSTEM",
          title: `Contact : ${input.subject}`,
          message: `${input.name} (${input.email}) écrit : ${input.message.slice(0, 180)}${input.message.length > 180 ? "…" : ""}`,
        })),
      });
    }

    return jsonOk({
      ok: true,
      message:
        "Votre message a été envoyé à l'équipe SamaTroc. Nous vous répondrons dans les plus brefs délais.",
    });
  });
}
