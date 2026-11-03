import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, readBody, requireAdmin, ApiError, jsonOk, logAdminAction } from "@/lib/api-utils";
import { adminReportActionSchema } from "@/lib/validators";

/** Traitement d'un signalement */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const input = await readBody(req, adminReportActionSchema);

    const report = await db.report.findUnique({ where: { id } });
    if (!report) throw new ApiError(404, "Signalement introuvable");

    const status = input.action === "resolve" ? "RESOLVED" : "DISMISSED";
    await db.report.update({
      where: { id },
      data: { status, resolution: input.resolution || null, handledById: admin.id },
    });

    await db.notification.create({
      data: {
        userId: report.reporterId,
        type: "REPORT_UPDATE",
        title: "Signalement traité",
        body:
          status === "RESOLVED"
            ? "Votre signalement a été traité par notre équipe. Merci de contribuer à la confiance sur SamaTroc."
            : "Votre signalement a été examiné : aucune action n'était nécessaire après vérification.",
      },
    });

    await logAdminAction(admin.id, `REPORT_${status}`, "REPORT", id, input.resolution);

    return jsonOk({ ok: true, message: status === "RESOLVED" ? "Signalement résolu" : "Signalement rejeté" });
  });
}
