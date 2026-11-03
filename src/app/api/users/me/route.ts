import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, readBody, requireAuth, jsonOk } from "@/lib/api-utils";
import { updateProfileSchema } from "@/lib/validators";

/** Met à jour le profil de l'utilisateur connecté */
export async function PATCH(req: NextRequest) {
  return handleRoute(async () => {
    const session = await requireAuth();
    const input = await readBody(req, updateProfileSchema);

    const userData: Record<string, unknown> = {};
    if (input.firstName !== undefined) userData.firstName = input.firstName;
    if (input.lastName !== undefined) userData.lastName = input.lastName;
    if (input.phone !== undefined) userData.phone = input.phone || null;
    if (input.city !== undefined) userData.city = input.city || null;
    if (input.avatarUrl !== undefined) userData.avatarUrl = input.avatarUrl || null;

    const profileData: Record<string, unknown> = {};
    if (input.bio !== undefined) profileData.bio = input.bio || null;
    if (input.quartier !== undefined) profileData.quartier = input.quartier || null;
    if (input.showPhone !== undefined) profileData.showPhone = input.showPhone;
    if (input.whatsappEnabled !== undefined) profileData.whatsappEnabled = input.whatsappEnabled;

    const user = await db.user.update({
      where: { id: session.id },
      data: {
        ...userData,
        ...(Object.keys(profileData).length > 0
          ? { profile: { upsert: { create: profileData, update: profileData } } }
          : {}),
      },
      include: { profile: true },
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
        profile: user.profile
          ? {
              bio: user.profile.bio,
              quartier: user.profile.quartier,
              showPhone: user.profile.showPhone,
              whatsappEnabled: user.profile.whatsappEnabled,
            }
          : null,
      },
    });
  });
}
