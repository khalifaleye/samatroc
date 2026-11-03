"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Save, Settings2, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useNavigate } from "@/stores/router-store";
import { handleAdminError } from "./admin-shared";

type SettingsMap = Record<string, string>;

const GENERAL_FIELDS: { key: string; label: string; placeholder: string; type?: string }[] = [
  { key: "platform_name", label: "Nom de la plateforme", placeholder: "SamaTroc" },
  { key: "platform_email", label: "Email de contact", placeholder: "contact@samatroc.sn", type: "email" },
  { key: "platform_phone", label: "Téléphone de contact", placeholder: "+221 33 800 00 00" },
];

const PUBLICATION_FIELDS: { key: string; label: string; placeholder?: string; suffix?: string }[] = [
  { key: "publication_fee", label: "Frais de publication", placeholder: "500", suffix: "FCFA" },
  { key: "listing_validity_days", label: "Durée de validité des annonces", placeholder: "30", suffix: "jours de validité" },
];

const DEMO_FIELDS: { key: string; label: string }[] = [
  { key: "demo_stats_users", label: "Membres affichés (démonstration)" },
  { key: "demo_stats_listings", label: "Annonces affichées (démonstration)" },
  { key: "demo_stats_exchanges", label: "Échanges affichés (démonstration)" },
];

const SOCIAL_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "facebook_url", label: "Page Facebook", placeholder: "https://facebook.com/samatroc" },
  { key: "instagram_url", label: "Compte Instagram", placeholder: "https://instagram.com/samatroc" },
  { key: "tiktok_url", label: "Compte TikTok", placeholder: "https://tiktok.com/@samatroc" },
  { key: "youtube_url", label: "Chaîne YouTube", placeholder: "https://youtube.com/@samatroc" },
  { key: "whatsapp_number", label: "Numéro WhatsApp", placeholder: "+221 77 123 45 67" },
];

/** Paramètres généraux de la plateforme */
export default function AdminSettings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ settings: SettingsMap }>("/api/admin/settings");
      setSettings(res.settings);
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const setValue = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const getValue = (key: string): string => settings[key] ?? "";

  const autoModerate = getValue("auto_moderate") === "true";

  const submit = async () => {
    setSaving(true);
    try {
      const payload: SettingsMap = {};
      const keys = [
        "platform_name",
        "platform_email",
        "platform_phone",
        "publication_fee",
        "listing_validity_days",
        "auto_moderate",
        "demo_stats_users",
        "demo_stats_listings",
        "demo_stats_exchanges",
        "facebook_url",
        "instagram_url",
        "tiktok_url",
        "youtube_url",
        "whatsapp_number",
        "announcement_banner",
      ];
      for (const key of keys) {
        payload[key] = getValue(key);
      }
      const res = await api.put<{ settings: SettingsMap; message?: string }>(
        "/api/admin/settings",
        { settings: payload }
      );
      toast.success(res.message ?? "Paramètres enregistrés");
      setSettings(res.settings);
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setSaving(false);
    }
  };

  if (loading && Object.keys(settings).length === 0) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Général */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-forest-800 text-lg">
            <Settings2 size={19} aria-hidden="true" />
            Général
          </CardTitle>
          <CardDescription>Identité et coordonnées publiques de la plateforme.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {GENERAL_FIELDS.map((f) => (
            <div key={f.key} className="grid gap-2">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                type={f.type ?? "text"}
                value={getValue(f.key)}
                onChange={(e) => setValue(f.key, e.target.value)}
                placeholder={f.placeholder}
                maxLength={120}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Publication */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-forest-800 text-lg">
            <Sparkles size={19} aria-hidden="true" />
            Publication
          </CardTitle>
          <CardDescription>
            Frais de publication encaissés et cycle de vie des annonces.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {PUBLICATION_FIELDS.map((f) => (
            <div key={f.key} className="grid gap-2">
              <Label htmlFor={f.key}>{f.label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={f.key}
                  type="number"
                  min={0}
                  value={getValue(f.key)}
                  onChange={(e) => setValue(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="max-w-[180px]"
                />
                <span className="text-sm text-muted-foreground">{f.suffix}</span>
              </div>
            </div>
          ))}
          <div className="flex items-start justify-between gap-4 rounded-lg border bg-mint-50/50 p-4">
            <div>
              <Label htmlFor="auto_moderate" className="cursor-pointer">
                Modération automatique
              </Label>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Placer automatiquement les annonces en modération avant publication. Si
                désactivé, seules les annonces détectées comme suspectes passent en modération.
              </p>
            </div>
            <Switch
              id="auto_moderate"
              checked={autoModerate}
              onCheckedChange={(checked) => setValue("auto_moderate", checked ? "true" : "false")}
              className="mt-1 shrink-0"
            />
          </div>
        </CardContent>
      </Card>

      {/* Statistiques de démonstration */}
      <Card className="border-mango-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-mango-700 text-lg">
            <Sparkles size={19} aria-hidden="true" />
            Statistiques de démonstration
          </CardTitle>
          <CardDescription className="text-mango-700">
            Ces chiffres, clairement identifiés comme démonstration, sont affichés en page
            d&apos;accueil tant que la plateforme n&apos;est pas officiellement lancée.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {DEMO_FIELDS.map((f) => (
            <div key={f.key} className="grid gap-2">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                type="number"
                min={0}
                value={getValue(f.key)}
                onChange={(e) => setValue(f.key, e.target.value)}
                className="max-w-[180px]"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Réseaux sociaux & contact */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-forest-800 text-lg">
            <Share2 size={19} aria-hidden="true" />
            Réseaux sociaux &amp; contact
          </CardTitle>
          <CardDescription>
            Liens affichés en pied de page et canaux de messagerie directs.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {SOCIAL_FIELDS.map((f) => (
            <div key={f.key} className="grid gap-2">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                value={getValue(f.key)}
                onChange={(e) => setValue(f.key, e.target.value)}
                placeholder={f.placeholder}
                maxLength={200}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bannière d'annonce */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-forest-800 text-lg">
            <Megaphone size={19} aria-hidden="true" />
            Bannière d&apos;annonce
          </CardTitle>
          <CardDescription>
            Message affiché en haut du site si renseigné. Laissez vide pour masquer la bannière.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Label htmlFor="announcement_banner">Message de la bannière</Label>
            <Input
              id="announcement_banner"
              value={getValue("announcement_banner")}
              onChange={(e) => setValue("announcement_banner", e.target.value)}
              placeholder="Exemple : SamaTroc arrive bientôt, inscrivez-vous dès maintenant"
              maxLength={200}
            />
            {getValue("announcement_banner").trim() ? (
              <div className="mt-1 rounded-lg bg-forest-700 px-4 py-2.5 text-center text-sm font-medium text-white">
                {getValue("announcement_banner")}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Enregistrement */}
      <div className="flex justify-end sticky bottom-4">
        <Button
          className="bg-forest-700 hover:bg-forest-800 gap-2 shadow-card"
          onClick={() => void submit()}
          disabled={saving}
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Save size={15} aria-hidden="true" />
          )}
          Enregistrer les paramètres
        </Button>
      </div>
    </div>
  );
}
