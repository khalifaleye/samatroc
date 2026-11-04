import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, readBody, requireAdmin, ApiError, jsonOk, logAdminAction } from "@/lib/api-utils";
import { adminReportActionSchema } from "@/lib/validators";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Traitement d'un signalement.
 * Privilégie la fonction SQL SECURITY DEFINER `resolve_report`
 * (20260101000002_functions.sql : statut RESOLVED|DISMISSED, admin vérifié via
 * is_admin() + auth.uid(), notification au déclarant et journalisation
 * admin_logs incluses) ; repli applicatif Prisma à l'identique si le
 * client/rpc n'est pas disponible. Format de réponse inchangé.
 */
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
    const adminNotes = input.resolution || null;
    let done = false;

    const supabase = await getSupabaseServerClient();
    if (supabase) {
      try {
        const { error } = await supabase.rpc("resolve_report", {
          p_report_id: id,
          p_status: status,
          p_admin_notes: adminNotes,
        });
        if (!error) done = true;
        else console.error("[admin/reports] resolve_report SQL :", error.message);
      } catch (error) {
        console.error("[admin/reports] resolve_report indisponible :", error);
      }
    }

    // Repli backend de confiance (même logique que la fonction SQL)
    if (!done) {
      await db.report.update({
        where: { id },
        data: { status, adminNotes, resolvedAt: new Date() },
      });

      if (report.reporterId) {
        await db.notification.create({
          data: {
            userId: report.reporterId,
            type: "REPORT_UPDATE",
            title: "Signalement traité",
            message:
              status === "RESOLVED"
                ? "Votre signalement a été traité."
                : "Votre signalement a été clôturé.",
            relatedId: report.id,
          },
        });
      }

      await logAdminAction(admin.id, `REPORT_${status}`, "REPORT", id, input.resolution);
    }

    return jsonOk({ ok: true, message: status === "RESOLVED" ? "Signalement résolu" : "Signalement rejeté" });
  });
}
