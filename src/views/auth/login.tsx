"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout, FieldError } from "@/views/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import { ApiClientError } from "@/lib/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginView() {
  const navigate = useRouter((s) => s.navigate);
  const status = useAuth((s) => s.status);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<Record<string, string> | null>(null);

  // Déjà connecté : accès direct à l'espace personnel
  useEffect(() => {
    if (status === "authenticated") {
      navigate("dashboard");
    }
  }, [status, navigate]);

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!email.trim()) errors.email = "Adresse e-mail requise";
    else if (!EMAIL_REGEX.test(email.trim())) errors.email = "Adresse e-mail invalide";
    if (!password) errors.password = "Mot de passe requis";
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
      await useAuth.getState().login(email.trim(), password);
      const firstName = useAuth.getState().user?.firstName ?? "";
      toast.success(`Bienvenue ${firstName} !`);
      navigate("dashboard");
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

  function prefill(demoEmail: string, demoPassword: string) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setFields(null);
  }

  return (
    <AuthLayout
      title="Connexion"
      subtitle="Heureux de vous revoir sur SamaTroc."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Adresse e-mail</Label>
          <Input
            id="login-email"
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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Mot de passe</Label>
            <button
              type="button"
              onClick={() => navigate("forgot-password")}
              className="text-xs font-medium text-forest-600 underline-offset-4 hover:underline"
            >
              Mot de passe oublié ?
            </button>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Votre mot de passe"
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

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={18} aria-hidden="true" />
          ) : (
            <LogIn size={18} aria-hidden="true" />
          )}
          Se connecter
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <button
          type="button"
          onClick={() => navigate("register")}
          className="font-semibold text-forest-700 underline-offset-4 hover:underline"
        >
          S&apos;inscrire
        </button>
      </p>

      <aside className="mt-6 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-semibold text-forest-700">Comptes de démonstration</p>
        <div className="mt-1.5 space-y-1">
          <button
            type="button"
            onClick={() => prefill("moussa@demo.sn", "demo1234")}
            className="block w-full rounded px-1 text-left hover:text-forest-700"
            aria-label="Utiliser le compte de démonstration Moussa"
          >
            Membre : moussa@demo.sn / demo1234
          </button>
          <button
            type="button"
            onClick={() => prefill("admin@samatroc.sn", "admin1234")}
            className="block w-full rounded px-1 text-left hover:text-forest-700"
            aria-label="Utiliser le compte administrateur de démonstration"
          >
            Admin : admin@samatroc.sn / admin1234
          </button>
        </div>
      </aside>
    </AuthLayout>
  );
}
