import { destroySession, getSessionUser } from "@/lib/auth";
import { handleRoute, jsonOk } from "@/lib/api-utils";

export async function POST() {
  return handleRoute(async () => {
    await destroySession();
    return jsonOk({ ok: true });
  });
}
