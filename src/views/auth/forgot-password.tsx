"use client";

import { useState } from "react";
import { KeyRound, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout, FieldError } from "@/views/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/stores/router-store";
import { api, ApiClientError } from "@/lib/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordView() {
  const navigate = useRouter((s) => s.navigate);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetToken, setDevResetToken] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string> | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFields(null);

    if (!email.trim()) {
      setFields({ email: "Adresse e-mail requise" });
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setFields({ email: "Adresse e-mail invalide" });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<{ ok: boolean; devResetToken?: string }>(
        "/api/auth/forgot-password",
        { email: email.trim() }
      );
      setSent(true);
      setDevResetToken(res.devResetToken ?? null);
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
      title="Mot de passe oublié"
      subtitle="Nous vous enverrons les instructions de réinitialisation."
    >
      {sent ? (
        <div className="space-y-5 text-center">
          <MailCheck className="mx-auto text-emerald-brand-500" size={48} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Si un compte existe avec l&apos;adresse{" "}
            <span className="font-semibold text-forest-700">{email}</span>, vous recevrez
            un e-mail contenant un lien de réinitialisation dans quelques minutes.
          </p>
          {devResetToken ? (
            <Button
              type="button"
              onClick={() => navigate("reset-password", { token: devResetToken })}
              className="h-11 w-full bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
            >
              <KeyRound size={18} aria-hidden="true" />
              Continuer la réinitialisation (démo)
            </Button>
          ) : null}
          <p className="text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => navigate("login")}
              className="font-semibold text-forest-700 underline-offset-4 hover:underline"
            >
              Retour à la connexion
            </button>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email">Adresse e-mail</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.sn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fields?.email)}
              className="h-11"
            />
            <FieldError message={fields?.email} />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} aria-hidden="true" />
            ) : (
              <KeyRound size={18} aria-hidden="true" />
            )}
            Envoyer les instructions
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
      )}
    </AuthLayout>
  );
}
