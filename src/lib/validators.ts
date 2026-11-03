/**
 * Schémas de validation Zod SamaTroc
 * Validation systématique côté serveur de toutes les données entrantes.
 */
import { z } from "zod";

const phoneRegex = /^(\+221)?[0-9\s]{9,15}$/;

export const registerSchema = z.object({
  firstName: z.string().trim().min(2, "Le prénom doit contenir au moins 2 caractères").max(50),
  lastName: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères").max(50),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(72, "Le mot de passe est trop long"),
  phone: z.string().trim().regex(phoneRegex, "Numéro de téléphone invalide").optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  acceptTerms: z.literal(true, { message: "Vous devez accepter les conditions d'utilisation" }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Jeton invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères").max(72),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères").max(72),
});

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(50).optional(),
  lastName: z.string().trim().min(2).max(50).optional(),
  phone: z.string().trim().regex(phoneRegex, "Numéro invalide").optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  avatarUrl: z.string().max(500).optional().or(z.literal("")),
  bio: z.string().trim().max(500, "La bio ne peut dépasser 500 caractères").optional().or(z.literal("")),
  quartier: z.string().trim().max(80).optional().or(z.literal("")),
  showPhone: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
});

export const listingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Le titre doit contenir au moins 5 caractères")
    .max(100, "Le titre ne peut dépasser 100 caractères"),
  description: z
    .string()
    .trim()
    .min(20, "La description doit contenir au moins 20 caractères")
    .max(3000, "La description ne peut dépasser 3000 caractères"),
  categoryId: z.string().min(1, "Catégorie requise"),
  subcategoryId: z.string().optional().nullable(),
  condition: z.enum(["NEUF", "TRES_BON", "BON", "SATISFAISANT"]),
  city: z.string().trim().min(2, "Ville requise").max(60),
  quartier: z.string().trim().max(80).optional().or(z.literal("")),
  wantedText: z
    .string()
    .trim()
    .min(3, "Précisez ce que vous recherchez")
    .max(200, "Maximum 200 caractères"),
  wantedCategory: z.string().trim().max(60).optional().or(z.literal("")),
  wantedMultiple: z.boolean().default(false),
  images: z
    .array(
      z.object({
        url: z.string().min(1),
        isPrimary: z.boolean().default(false),
      })
    )
    .max(6, "Maximum 6 photos par annonce")
    .default([]),
  saveAsDraft: z.boolean().default(false),
});
export type ListingInput = z.infer<typeof listingSchema>;

export const listingUpdateSchema = listingSchema.partial().extend({
  images: z
    .array(
      z.object({
        url: z.string().min(1),
        isPrimary: z.boolean().default(false),
      })
    )
    .max(6)
    .optional(),
});

export const listingStatusSchema = z.object({
  status: z.enum(["PUBLISHED", "DEACTIVATED", "EXCHANGED"]),
});

export const proposalSchema = z.object({
  offeredListingId: z.string().optional().nullable(),
  offeredText: z
    .string()
    .trim()
    .min(5, "Décrivez l'objet que vous proposez")
    .max(300)
    .optional()
    .or(z.literal("")),
  images: z.array(z.string()).max(4).default([]),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const proposalActionSchema = z.object({
  action: z.enum(["accept", "refuse", "discuss", "counter", "cancel", "complete"]),
  counterText: z.string().trim().max(500).optional().or(z.literal("")),
});

export const conversationStartSchema = z.object({
  userId: z.string().min(1, "Destinataire requis"),
  listingId: z.string().optional().nullable(),
  message: z.string().trim().min(1, "Message requis").max(2000),
});

export const messageSchema = z.object({
  content: z.string().trim().min(1, "Message vide").max(2000, "Message trop long"),
  imageUrl: z.string().optional().or(z.literal("")),
});

export const reportSchema = z.object({
  targetType: z.enum(["LISTING", "USER", "MESSAGE"]),
  targetId: z.string().min(1),
  reason: z.enum(["FRAUDE", "CONTENU_INTERDIT", "OFFENSANT", "CONTREFACON", "FAUX_PROFIL", "AUTRE"]),
  details: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const paymentInitiateSchema = z.object({
  listingId: z.string().min(1, "Annonce requise"),
  provider: z.enum(["WAVE", "ORANGE_MONEY", "TEST"]),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Numéro de téléphone invalide")
    .optional()
    .or(z.literal("")),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(80),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  subject: z.string().trim().min(3, "Objet requis").max(120),
  message: z.string().trim().min(10, "Message trop court (10 caractères minimum)").max(3000),
});

// ---------- Schémas administrateur ----------
export const adminUserUpdateSchema = z.object({
  action: z.enum(["suspend", "reactivate", "setRole", "edit"]),
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]).optional(),
  firstName: z.string().trim().min(2).max(50).optional(),
  lastName: z.string().trim().min(2).max(50).optional(),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
});

export const adminListingActionSchema = z.object({
  action: z.enum(["publish", "refuse", "feature", "unfeature"]),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  edits: z
    .object({
      title: z.string().trim().min(5).max(100).optional(),
      description: z.string().trim().min(20).max(3000).optional(),
      city: z.string().trim().max(60).optional(),
      wantedText: z.string().trim().max(200).optional(),
    })
    .optional(),
});

export const adminCategorySchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(60),
  icon: z.string().trim().max(40).default("package"),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hex invalide").default("#0e5c3d"),
  sortOrder: z.number().int().min(0).default(0),
  parentId: z.string().optional().nullable(),
});

export const adminReorderSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export const adminReportActionSchema = z.object({
  action: z.enum(["resolve", "dismiss"]),
  resolution: z.string().trim().max(500).optional().or(z.literal("")),
});

export const adminContentSchema = z.object({
  page: z.enum(["ABOUT", "HOW_IT_WORKS", "FAQ", "SAFETY", "CGU", "PRIVACY", "MODERATION", "CONTACT"]),
  title: z.string().trim().min(2).max(150),
  body: z.string().trim().min(10).max(50000),
});

export const adminSettingsSchema = z.object({
  settings: z.record(z.string(), z.string().max(2000)),
});

export const citySchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(60),
  region: z.string().trim().max(60).optional().or(z.literal("")),
});
