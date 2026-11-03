import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { handleRoute, readBody, ApiError, getClientIp, jsonOk } from "@/lib/api-utils";
import { registerSchema } from "@/lib/validators";
import { rateLimit, retryAfter } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const ip = getClientIp(req);
    if (!rateLimit(`register:${ip}`, 3, 60 * 60 * 1000)) {
      throw new ApiError(
        429,
        `Trop d'inscriptions depuis cette adresse. Réessayez dans ${retryAfter(`register:${ip}`)} secondes.`
      );
    }

    const input = await readBody(req, registerSchema);

    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ApiError(409, "Un compte existe déjà avec cette adresse e-mail", {
        email: "Cette adresse e-mail est déjà utilisée",
      });
    }

    const passwordHash = await hashPassword(input.password);

    const user = await db.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
        city: input.city || null,
        role: "USER",
        profile: { create: {} },
      },
    });

    await createSession(user.id);

    // Jeton de vérification e-mail (envoi réel à brancher sur un SMTP en production)
    const tokenBytes = new Uint8Array(24);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    await db.verificationToken.create({
      data: {
        userId: user.id,
        type: "EMAIL",
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return jsonOk({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        city: user.city,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        createdAt: user.createdAt.toISOString(),
        profile: { bio: null, quartier: null, showPhone: false, whatsappEnabled: true },
        unreadNotifications: 0,
        unreadMessages: 0,
      },
      // Le jeton n'est retourné qu'en développement (aucun SMTP configuré)
      devVerifyToken: process.env.NODE_ENV === "production" ? null : token,
    });
  });
}
