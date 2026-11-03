"use client";

import { create } from "zustand";

export type RouteParams = Record<string, string>;

interface RouterState {
  view: string;
  params: RouteParams;
  query: RouteParams;
  history: string[]; // pile de vues précédentes ("view?param1=..")
  navigate: (view: string, params?: RouteParams, query?: RouteParams) => void;
  back: () => void;
}

function serialize(view: string, params: RouteParams): string {
  const p = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return p ? `${view}?${p}` : view;
}

/**
 * Routeur applicatif SamaTroc.
 * L'application est servie sur la route "/" ; la navigation entre les vues
 * (accueil, explorer, détail d'annonce, tableau de bord, administration…)
 * est gérée côté client pour une expérience instantanée, avec un historique interne.
 */
export const useRouter = create<RouterState>((set, get) => ({
  view: "home",
  params: {},
  query: {},
  history: [],
  navigate: (view, params = {}, query = {}) => {
    const current = get();
    const sameView =
      current.view === view &&
      JSON.stringify(current.params) === JSON.stringify(params) &&
      JSON.stringify(current.query) === JSON.stringify(query);
    if (sameView) return;

    const key = serialize(current.view, current.params);
    set({
      view,
      params,
      query,
      history: [...current.history.slice(-20), key],
    });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
    }
  },
  back: () => {
    const { history } = get();
    const prev = history[history.length - 1];
    if (!prev) {
      get().navigate("home");
      return;
    }
    const [view, queryString] = prev.split("?");
    const params: RouteParams = {};
    for (const [k, v] of new URLSearchParams(queryString ?? "").entries()) {
      params[k] = v;
    }
    set({ view, params, query: {}, history: history.slice(0, -1) });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
    }
  },
}));

/** Hook pratique : fonction de navigation */
export function useNavigate() {
  return useRouter((s) => s.navigate);
}
