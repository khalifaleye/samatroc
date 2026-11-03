"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  Camera,
  Loader2,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import AccountShell from "@/views/account/account-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/stores/auth-store";
import { api, ApiClientError, compressImage } from "@/lib/api";
import { formatDate, SENEGAL_CITIES } from "@/lib/constants";

interface ProfileFormState {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  quartier: string;
  bio: string;
  showPhone: boolean;
  whatsappEnabled: boolean;
}

export default function ProfileView() {
  const user = useAuth((s) => s.user);
  const refresh = useAuth((s) => s.refresh);

  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Sécurité
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwdFields, setPwdFields] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? "",
      city: user.city ?? "",
      quartier: user.profile?.quartier ?? "",
      bio: user.profile?.bio ?? "",
      showPhone: user.profile?.showPhone ?? false,
      whatsappEnabled: user.profile?.whatsappEnabled ?? false,
    });
  }, [user]);

  if (!user || !form) {
    return (
      <AccountShell active="profile" title="Mon profil">
        <div className="flex flex-col items-center gap-3 py-20" role="status">
          <Loader2 className="animate-spin text-forest-600" size={28} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Chargement de votre profil…</p>
        </div>
      </AccountShell>
    );
  }

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  function set<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo trop lourde. Taille maximale : 5 Mo.");
      return;
    }
    setUploadingAvatar(true);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("files", compressed);
      const res = await api.upload<{ urls: string[] }>("/api/upload", fd);
      await api.patch("/api/users/me", { avatarUrl: res.urls[0] });
      await refresh();
      toast.success("Photo de profil mise à jour");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Téléversement impossible");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFields(null);
    if (!form.firstName.trim()) {
      setFields({ firstName: "Prénom requis" });
      return;
    }
    if (!form.lastName.trim()) {
      setFields({ lastName: "Nom requis" });
      return;
    }

    setSaving(true);
    try {
      await api.patch("/api/users/me", {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        city: form.city || undefined,
        quartier: form.quartier.trim() || undefined,
        bio: form.bio.trim() || undefined,
        showPhone: form.showPhone,
        whatsappEnabled: form.whatsappEnabled,
      });
      await refresh();
      toast.success("Profil mis à jour");
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFields(error.fields ?? null);
        toast.error(error.message);
      } else {
        toast.error("Enregistrement impossible");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdFields(null);
    if (!currentPassword) {
      setPwdFields({ currentPassword: "Mot de passe actuel requis" });
      return;
    }
    if (newPassword.length < 8) {
      setPwdFields({ newPassword: "8 caractères minimum" });
      return;
    }
    if (confirmPassword !== newPassword) {
      setPwdFields({ confirmPassword: "Les mots de passe ne correspondent pas" });
      return;
    }

    setSavingPassword(true);
    try {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Mot de passe modifié avec succès");
    } catch (error) {
      if (error instanceof ApiClientError) {
        setPwdFields(error.fields ?? null);
        toast.error(error.message);
      } else {
        toast.error("Modification impossible");
      }
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <AccountShell active="profile" title="Mon profil">
      <div className="grid gap-5 xl:grid-cols-5">
        {/* ---------- Informations personnelles ---------- */}
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-forest-800">
              <UserRound size={20} className="text-emerald-brand-600" aria-hidden="true" />
              Informations personnelles
            </CardTitle>
            <CardDescription>
              Membre depuis {formatDate(user.createdAt)}. Ces informations apparaissent sur vos annonces.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20 border-2 border-mint-200">
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={`Avatar de ${user.firstName}`} />
                      ) : null}
                    <AvatarFallback className="bg-forest-700 text-xl font-bold text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    aria-label="Changer ma photo de profil"
                    className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-forest-700 text-white shadow-card transition-transform hover:scale-105 disabled:opacity-60"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="animate-spin" size={14} aria-hidden="true" />
                    ) : (
                      <Camera size={14} aria-hidden="true" />
                    )}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                    aria-label="Choisir une photo de profil"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Photo carrée recommandée, 5 Mo maximum.
                  <br />
                  Formats JPEG, PNG, WebP.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-firstname">Prénom</Label>
                  <Input
                    id="profile-firstname"
                    value={form.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    aria-invalid={Boolean(fields?.firstName)}
                    className="h-11"
                  />
                  {fields?.firstName && (
                    <p role="alert" className="text-xs font-medium text-red-600">{fields.firstName}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profile-lastname">Nom</Label>
                  <Input
                    id="profile-lastname"
                    value={form.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    aria-invalid={Boolean(fields?.lastName)}
                    className="h-11"
                  />
                  {fields?.lastName && (
                    <p role="alert" className="text-xs font-medium text-red-600">{fields.lastName}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-email">Adresse e-mail</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="profile-email"
                    value={user.email}
                    readOnly
                    disabled
                    className="h-11 flex-1 bg-muted/60"
                    aria-describedby="profile-email-verified"
                  />
                  <Badge
                    id="profile-email-verified"
                    className={
                      user.emailVerified
                        ? "shrink-0 border-transparent bg-mint-100 font-semibold text-forest-700"
                        : "shrink-0 border-transparent bg-mango-100 font-semibold text-mango-700"
                    }
                  >
                    <BadgeCheck size={13} aria-hidden="true" />
                    {user.emailVerified ? "Vérifié" : "Non vérifié"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-phone">Téléphone</Label>
                  <Input
                    id="profile-phone"
                    type="tel"
                    placeholder="+221 77 123 45 67"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profile-city">Ville</Label>
                  <Select value={form.city} onValueChange={(v) => set("city", v)}>
                    <SelectTrigger id="profile-city" className="h-11 w-full">
                      <SelectValue placeholder="Choisissez votre ville" />
                    </SelectTrigger>
                    <SelectContent>
                      {SENEGAL_CITIES.map((c) => (
                        <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-quartier">Quartier</Label>
                <Input
                  id="profile-quartier"
                  placeholder="Ex. Sacré-Cœur, Médina…"
                  value={form.quartier}
                  onChange={(e) => set("quartier", e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-bio">Présentation</Label>
                <Textarea
                  id="profile-bio"
                  placeholder="Décrivez-vous en quelques mots : ce que vous aimez échanger, votre quartier…"
                  value={form.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  maxLength={500}
                  className="min-h-24"
                />
                <p className="text-right text-[11px] text-muted-foreground">{form.bio.length}/500</p>
              </div>

              <Separator />

              {/* Confidentialité rapide */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Afficher mon numéro sur mes annonces</p>
                    <p className="text-xs text-muted-foreground">
                      Votre téléphone apparaît alors publiquement sur vos annonces publiées.
                    </p>
                  </div>
                  <Switch
                    checked={form.showPhone}
                    onCheckedChange={(v) => set("showPhone", v)}
                    aria-label="Afficher mon numéro sur mes annonces"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Autoriser le contact WhatsApp</p>
                    <p className="text-xs text-muted-foreground">
                      Un bouton WhatsApp est proposé aux membres intéressés par vos objets.
                    </p>
                  </div>
                  <Switch
                    checked={form.whatsappEnabled}
                    onCheckedChange={(v) => set("whatsappEnabled", v)}
                    aria-label="Autoriser le contact WhatsApp"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="h-11 w-full bg-emerald-brand-500 text-white hover:bg-emerald-brand-600 sm:w-auto"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                ) : (
                  <Save size={18} aria-hidden="true" />
                )}
                Enregistrer les modifications
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ---------- Sécurité ---------- */}
        <Card className="h-fit xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-forest-800">
              <ShieldCheck size={20} className="text-emerald-brand-600" aria-hidden="true" />
              Sécurité
            </CardTitle>
            <CardDescription>Modifiez votre mot de passe régulièrement.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pwd-current">Mot de passe actuel</Label>
                <Input
                  id="pwd-current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  aria-invalid={Boolean(pwdFields?.currentPassword)}
                  className="h-11"
                />
                {pwdFields?.currentPassword && (
                  <p role="alert" className="text-xs font-medium text-red-600">{pwdFields.currentPassword}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd-new">Nouveau mot de passe</Label>
                <Input
                  id="pwd-new"
                  type="password"
                  autoComplete="new-password"
                  placeholder="8 caractères minimum"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  aria-invalid={Boolean(pwdFields?.newPassword)}
                  className="h-11"
                />
                {pwdFields?.newPassword && (
                  <p role="alert" className="text-xs font-medium text-red-600">{pwdFields.newPassword}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd-confirm">Confirmer le nouveau mot de passe</Label>
                <Input
                  id="pwd-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={Boolean(pwdFields?.confirmPassword)}
                  className="h-11"
                />
                {pwdFields?.confirmPassword && (
                  <p role="alert" className="text-xs font-medium text-red-600">{pwdFields.confirmPassword}</p>
                )}
              </div>
              <Button
                type="submit"
                disabled={savingPassword}
                className="h-11 w-full bg-forest-700 text-white hover:bg-forest-800"
              >
                {savingPassword ? (
                  <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                ) : (
                  <Lock size={18} aria-hidden="true" />
                )}
                Changer mon mot de passe
              </Button>
            </form>

            <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-mint-50 p-3 text-xs text-muted-foreground">
              <Mail size={15} className="mt-0.5 shrink-0 text-forest-600" aria-hidden="true" />
              <p>
                Votre adresse de connexion est <span className="font-medium text-forest-700">{user.email}</span>.
                Pour la modifier, contactez l&apos;assistance SamaTroc.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AccountShell>
  );
}
