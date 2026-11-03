"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, MailCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout, FieldError } from "@/views/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import { api, ApiClientError } from "@/lib/api";
import { SENEGAL_CITIES } from "@/lib/constants";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

const INITIAL_FORM: RegisterFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  city: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
};

export default function RegisterView() {
  const navigate = useRouter((s) => s.navigate);
  const status = useAuth((s) => s.status);

  const [form, setForm] = useState<RegisterFormState>(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<Record<string, string> | null>(null);

  // Mode démo : jeton de vérification d'e-mail renvoyé après l'inscription
  const [devVerifyToken, setDevVerifyToken] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Déjà connecté (après inscription sans vérification) : espace personnel
  useEffect(() => {
    if (status === "authenticated" && !devVerifyToken) {
      navigate("dashboard");
    }
  }, [status, devVerifyToken, navigate]);

  function set<K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!form.firstName.trim()) errors.firstName = "Prénom requis";
    if (!form.lastName.trim()) errors.lastName = "Nom requis";
    if (!form.email.trim()) errors.email = "Adresse e-mail requise";
    else if (!EMAIL_REGEX.test(form.email.trim())) errors.email = "Adresse e-mail invalide";
    if (form.phone.trim() && form.phone.replace(/\D/g, "").length < 9)
      errors.phone = "Numéro de téléphone invalide";
    if (!form.city) errors.city = "Ville requise";
    if (!form.password) errors.password = "Mot de passe requis";
    else if (form.password.length < 8)
      errors.password = "Le mot de passe doit contenir au moins 8 caractères";
    if (form.confirmPassword !== form.password)
      errors.confirmPassword = "Les mots de passe ne correspondent pas";
    if (!form.acceptTerms) errors.acceptTerms = "Vous devez accepter les conditions d'utilisation";
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFields(null);
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFields(errors);
      return;
    }

    setLoading(true);
    try {
      const { verifyToken } = await useAuth.getState().register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        city: form.city,
        acceptTerms: true,
      });

      if (verifyToken) {
        setDevVerifyToken(verifyToken);
        toast.success("Compte créé. Vérifiez votre adresse e-mail.");
      } else {
        const firstName = useAuth.getState().user?.firstName ?? "";
        toast.success(`Bienvenue ${firstName} !`);
        navigate("dashboard");
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFields(error.fields ?? null);
        toast.error(error.message);
      } else {
        toast.error("Une erreur inattendue est survenue");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail() {
    if (!devVerifyToken) return;
    setVerifying(true);
    try {
      await api.post("/api/auth/verify-email", { token: devVerifyToken });
      toast.success("Adresse e-mail vérifiée avec succès");
      navigate("home");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Vérification impossible");
    } finally {
      setVerifying(false);
    }
  }

  // Panneau de succès (mode démo : vérification d'e-mail immédiate)
  if (devVerifyToken) {
    return (
      <AuthLayout
        title="Compte créé avec succès"
        subtitle="Une dernière étape pour activer votre compte."
      >
        <div className="space-y-5 text-center">
          <MailCheck className="mx-auto text-emerald-brand-500" size={48} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Un e-mail de vérification a été envoyé à{" "}
            <span className="font-semibold text-forest-700">{form.email}</span>. En mode
            démonstration, vous pouvez vérifier votre adresse immédiatement.
          </p>
          <Button
            type="button"
            onClick={handleVerifyEmail}
            disabled={verifying}
            className="h-11 w-full bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
          >
            {verifying ? (
              <Loader2 className="animate-spin" size={18} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={18} aria-hidden="true" />
            )}
            Vérifier mon adresse e-mail (mode démo)
          </Button>
          <button
            type="button"
            onClick={() => navigate("home")}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Continuer sans vérifier
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Rejoignez la communauté SamaTroc en deux minutes."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="reg-firstname">Prénom</Label>
            <Input
              id="reg-firstname"
              autoComplete="given-name"
              placeholder="Moussa"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              aria-invalid={Boolean(fields?.firstName)}
              className="h-11"
            />
            <FieldError message={fields?.firstName} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-lastname">Nom</Label>
            <Input
              id="reg-lastname"
              autoComplete="family-name"
              placeholder="Diop"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              aria-invalid={Boolean(fields?.lastName)}
              className="h-11"
            />
            <FieldError message={fields?.lastName} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-email">Adresse e-mail</Label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.sn"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={Boolean(fields?.email)}
            className="h-11"
          />
          <FieldError message={fields?.email} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-phone">
            Téléphone <span className="text-muted-foreground">(facultatif)</span>
          </Label>
          <Input
            id="reg-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+221 77 123 45 67"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            aria-invalid={Boolean(fields?.phone)}
            className="h-11"
          />
          <FieldError message={fields?.phone} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-city">Ville</Label>
          <Select value={form.city} onValueChange={(v) => set("city", v)}>
            <SelectTrigger id="reg-city" aria-invalid={Boolean(fields?.city)} className="h-11 w-full">
              <SelectValue placeholder="Choisissez votre ville" />
            </SelectTrigger>
            <SelectContent>
              {SENEGAL_CITIES.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={fields?.city} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-password">Mot de passe</Label>
          <div className="relative">
            <Input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="8 caractères minimum"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              aria-invalid={Boolean(fields?.password)}
              className="h-11 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-forest-700"
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
          <FieldError message={fields?.password} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-confirm">Confirmer le mot de passe</Label>
          <Input
            id="reg-confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Répétez votre mot de passe"
            value={form.confirmPassword}
            onChange={(e) => set("confirmPassword", e.target.value)}
            aria-invalid={Boolean(fields?.confirmPassword)}
            className="h-11"
          />
          <FieldError message={fields?.confirmPassword} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="reg-terms"
              checked={form.acceptTerms}
              onCheckedChange={(v) => set("acceptTerms", v === true)}
              className="mt-0.5"
              aria-invalid={Boolean(fields?.acceptTerms)}
            />
            <Label htmlFor="reg-terms" className="text-sm font-normal leading-relaxed">
              J&apos;accepte les{" "}
              <button
                type="button"
                onClick={() => navigate("cgu")}
                className="font-medium text-forest-700 underline underline-offset-2"
              >
                conditions d&apos;utilisation
              </button>{" "}
              et la{" "}
              <button
                type="button"
                onClick={() => navigate("privacy")}
                className="font-medium text-forest-700 underline underline-offset-2"
              >
                politique de confidentialité
              </button>
            </Label>
          </div>
          <FieldError message={fields?.acceptTerms} />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={18} aria-hidden="true" />
          ) : (
            <UserPlus size={18} aria-hidden="true" />
          )}
          Créer mon compte
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Déjà inscrit ?{" "}
        <button
          type="button"
          onClick={() => navigate("login")}
          className="font-semibold text-forest-700 underline-offset-4 hover:underline"
        >
          Se connecter
        </button>
      </p>
    </AuthLayout>
  );
}
