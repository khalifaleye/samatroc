"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  BellRing,
  CreditCard,
  Loader2,
  LogOut,
  Lock,
  Mail,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import AccountShell from "@/views/account/account-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import { api, ApiClientError } from "@/lib/api";
import { formatDate, formatFCFA } from "@/lib/constants";

export default function SettingsView() {
  const navigate = useRouter((s) => s.navigate);
  const user = useAuth((s) => s.user);
  const refresh = useAuth((s) => s.refresh);

  // Confidentialité
  const [showPhone, setShowPhone] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Sécurité
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwdFields, setPwdFields] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (!user) return;
    setShowPhone(user.profile?.showPhone ?? false);
    setWhatsappEnabled(user.profile?.whatsappEnabled ?? false);
  }, [user]);

  if (!user) {
    return (
      <AccountShell active="settings" title="Paramètres">
        <div className="flex flex-col items-center gap-3 py-20" role="status">
          <Loader2 className="animate-spin text-forest-600" size={28} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Chargement des paramètres…</p>
        </div>
      </AccountShell>
    );
  }

  async function handleSavePrivacy(next: { showPhone?: boolean; whatsappEnabled?: boolean }) {
    setSavingPrivacy(true);
    try {
      await api.patch("/api/users/me", next);
      await refresh();
      toast.success("Préférences de confidentialité mises à jour");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setSavingPrivacy(false);
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

  async function handleLogout() {
    try {
      await useAuth.getState().logout();
      toast.success("Vous êtes déconnecté. À bientôt !");
      navigate("home");
    } catch {
      toast.error("Déconnexion impossible. Réessayez.");
    }
  }

  const roleLabel =
    user.role === "ADMIN" ? "Administrateur" : user.role === "SUPER_ADMIN" ? "Super administrateur" : "Membre";

  return (
    <AccountShell active="settings" title="Paramètres">
      <div className="grid gap-5 xl:grid-cols-2">
        {/* ---------- Confidentialité ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-forest-800">
              <ShieldCheck size={20} className="text-emerald-brand-600" aria-hidden="true" />
              Confidentialité
            </CardTitle>
            <CardDescription>
              Contrôlez les informations visibles par les autres membres.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="settings-showphone" className="text-sm font-medium">
                  Afficher mon numéro de téléphone sur mes annonces
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Votre numéro apparaît alors sur chaque annonce publiée.
                </p>
              </div>
              <Switch
                id="settings-showphone"
                checked={showPhone}
                onCheckedChange={(v) => {
                  setShowPhone(v);
                  void handleSavePrivacy({ showPhone: v });
                }}
                disabled={savingPrivacy}
                aria-label="Afficher mon numéro de téléphone sur mes annonces"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="settings-whatsapp" className="text-sm font-medium">
                  Autoriser le contact WhatsApp
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Un bouton WhatsApp est proposé aux membres intéressés par vos objets.
                </p>
              </div>
              <Switch
                id="settings-whatsapp"
                checked={whatsappEnabled}
                onCheckedChange={(v) => {
                  setWhatsappEnabled(v);
                  void handleSavePrivacy({ whatsappEnabled: v });
                }}
                disabled={savingPrivacy}
                aria-label="Autoriser le contact WhatsApp"
              />
            </div>
          </CardContent>
        </Card>

        {/* ---------- Sécurité ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-forest-800">
              <Lock size={20} className="text-emerald-brand-600" aria-hidden="true" />
              Sécurité
            </CardTitle>
            <CardDescription>Modifiez régulièrement votre mot de passe.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="settings-pwd-current">Mot de passe actuel</Label>
                <Input
                  id="settings-pwd-current"
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
                <Label htmlFor="settings-pwd-new">Nouveau mot de passe</Label>
                <Input
                  id="settings-pwd-new"
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
                <Label htmlFor="settings-pwd-confirm">Confirmer le nouveau mot de passe</Label>
                <Input
                  id="settings-pwd-confirm"
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
                className="h-11 bg-forest-700 text-white hover:bg-forest-800"
              >
                {savingPassword ? (
                  <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                ) : (
                  <Lock size={18} aria-hidden="true" />
                )}
                Changer mon mot de passe
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ---------- Abonnement info ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-forest-800">
              <CreditCard size={20} className="text-emerald-brand-600" aria-hidden="true" />
              Mon abonnement info
            </CardTitle>
            <CardDescription>Comment fonctionnent les frais de publication.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              La publication de chaque annonce nécessite des frais uniques de{" "}
              <span className="font-semibold text-forest-700">{formatFCFA(500)}</span>, payés via
              Wave ou Orange Money. Ces frais couvrent le fonctionnement de la plateforme, la
              modération des annonces et la lutte contre la fraude.
            </p>
            <p>
              Ce montant ne correspond <span className="font-medium text-forest-700">en aucun cas</span>{" "}
              au prix ou à la valeur de l&apos;objet échangé : le troc reste entièrement gratuit
              entre membres.
            </p>
            <p>
              Pas d&apos;abonnement, pas de frais cachés : vous ne payez que lorsque vous publiez
              une nouvelle annonce.
            </p>
          </CardContent>
        </Card>

        {/* ---------- Compte ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-forest-800">
              <UserCog size={20} className="text-emerald-brand-600" aria-hidden="true" />
              Compte
            </CardTitle>
            <CardDescription>Informations de votre compte SamaTroc.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail size={15} aria-hidden="true" />
                Adresse e-mail
              </span>
              <span className="flex items-center gap-2">
                <span className="max-w-44 truncate text-sm font-medium text-foreground sm:max-w-none">
                  {user.email}
                </span>
                <Badge
                  className={
                    user.emailVerified
                      ? "shrink-0 border-transparent bg-mint-100 font-semibold text-forest-700"
                      : "shrink-0 border-transparent bg-mango-100 font-semibold text-mango-700"
                  }
                >
                  <BadgeCheck size={12} aria-hidden="true" />
                  {user.emailVerified ? "Vérifié" : "Non vérifié"}
                </Badge>
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Rôle</span>
              <Badge className="border-transparent bg-forest-700 font-semibold text-white">
                {roleLabel}
              </Badge>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Date d&apos;inscription</span>
              <span className="text-sm font-medium text-foreground">{formatDate(user.createdAt)}</span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-mint-50 p-3">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <BellRing size={15} className="text-forest-600" aria-hidden="true" />
                Les notifications importantes vous sont envoyées par e-mail et dans SamaTroc.
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              className="h-11 w-full border-red-200 text-red-600 hover:bg-red-50"
            >
              <LogOut size={18} aria-hidden="true" />
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    </AccountShell>
  );
}
