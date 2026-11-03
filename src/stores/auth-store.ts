"use client";

import { create } from "zustand";
import { api, ApiClientError } from "@/lib/api";

/** Utilisateur tel que renvoyé par /api/auth/me */
export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  city: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  profile: {
    bio: string | null;
    quartier: string | null;
    showPhone: boolean;
    whatsappEnabled: boolean;
  } | null;
}

interface MeResponse {
  user: (CurrentUser & { unreadNotifications: number; unreadMessages: number }) | null;
}

interface AuthState {
  user: (CurrentUser & { unreadNotifications: number; unreadMessages: number }) | null;
  status: "loading" | "authenticated" | "guest";
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
    city?: string;
    acceptTerms: true;
  }) => Promise<{ verifyToken: string | null }>;
  logout: () => Promise<void>;
  setUser: (
    user: (CurrentUser & { unreadNotifications: number; unreadMessages: number }) | null
  ) => void;
}

/**
 * Store d'authentification global.
 * La session est un cookie httpOnly ; le client ne stocke jamais de secret.
 */
export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: "loading",

  refresh: async () => {
    try {
      const data = await api.get<MeResponse>("/api/auth/me");
      set({
        user: data.user,
        status: data.user ? "authenticated" : "guest",
      });
    } catch {
      set({ user: null, status: "guest" });
    }
  },

  login: async (email, password) => {
    const data = await api.post<{ user: CurrentUser }>("/api/auth/login", {
      email,
      password,
    });
    set({
      user: { ...data.user, unreadNotifications: 0, unreadMessages: 0 },
      status: "authenticated",
    });
    // recharge les compteurs réels
    void api
      .get<MeResponse>("/api/auth/me")
      .then((d) => d.user && set({ user: d.user }))
      .catch(() => undefined);
  },

  register: async (input) => {
    const data = await api.post<{
      user: CurrentUser;
      devVerifyToken: string | null;
    }>("/api/auth/register", input);
    set({
      user: { ...data.user, unreadNotifications: 0, unreadMessages: 0 },
      status: "authenticated",
    });
    return { verifyToken: data.devVerifyToken };
  },

  logout: async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (error) {
      if (!(error instanceof ApiClientError)) throw error;
    }
    set({ user: null, status: "guest" });
  },

  setUser: (
    user: (CurrentUser & { unreadNotifications: number; unreadMessages: number }) | null
  ) => set({ user, status: user ? "authenticated" : "guest" }),
}));
