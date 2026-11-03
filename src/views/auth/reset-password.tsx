"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout, FieldError } from "@/views/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/stores/router-store";
import { api, ApiClientError } from "@/lib/api";

interface ResetPasswordViewProps {
  token?: string;
}

export default function ResetPasswordView({ token }: ResetPasswordViewProps) {
  const navigate = useRouter((s) => s.navigate);

  const [resetToken, setResetToken] = useState(token ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<Record<string, string> | null>(null);

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!resetToken.trim()) errors.token = "Code de réinitialisation requis";
    if (!password) errors.password = "Nouveau mot de passe requis";
    else if (password.length < 8)
      errors.password = "Le mot de passe doit contenir au moins 8 caractères";
    if (confirmPassword !== password)
      errors.confirmPassword = "Les mots de passe ne correspondent pas";
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
      await api.post("/api/auth/reset-password", {
        token: resetToken.trim(),
        password,
      });
      toast.success("Mot de passe réinitialisé. Connectez-vous avec votre nouveau mot de passe.");
      navigate("login");
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

  return (
    <AuthLayout
      title="Nouveau mot de passe"
      subtitle="Choisissez un mot de passe solide pour sécuriser votre compte."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reset-token">Code de réinitialisation</Label>
          <Input
            id="reset-token"
            placeholder="Collez le code reçu par e-mail"
            value={resetToken}
            onChange={(e) => setResetToken(e.target.value)}
            aria-invalid={Boolean(fields?.token)}
            className="h-11 font-mono text-sm"
          />
          <FieldError message={fields?.token} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reset-password">Nouveau mot de passe</Label>
          <div className="relative">
            <Input
              id="reset-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="8 caractères minimum"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          <Label htmlFor="reset-confirm">Confirmer le mot de passe</Label>
          <Input
            id="reset-confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Répétez votre nouveau mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-invalid={Boolean(fields?.confirmPassword)}
            className="h-11"
          />
          <FieldError message={fields?.confirmPassword} />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={18} aria-hidden="true" />
          ) : (
            <ShieldCheck size={18} aria-hidden="true" />
          )}
          Réinitialiser mon mot de passe
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => navigate("login")}
            className="font-semibold text-forest-700 underline-offset-4 hover:underline"
          >
            Retour à la connexion
          </button>
        </p>
      </form>
    </AuthLayout>
  );
}
