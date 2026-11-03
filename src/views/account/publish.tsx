"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  CloudUpload,
  FileText,
  Info,
  Loader2,
  PackagePlus,
  PartyPopper,
  Save,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import AccountShell from "@/views/account/account-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import { api, ApiClientError, compressImage } from "@/lib/api";
import { CONDITIONS, formatFCFA } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ---------- Types ----------

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  children?: { id: string; name: string; slug: string }[];
}

interface CityItem {
  id: string;
  name: string;
  region: string;
}

interface PaymentProvider {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface PaymentConfig {
  mode: string;
  fee: number;
  currency: string;
  providers: PaymentProvider[];
}

interface WizardImages {
  url: string;
  isPrimary: boolean;
}

const WANTED_SUGGESTIONS = [
  "ordinateur portable",
  "téléphone",
  "vélo",
  "canapé",
  "jouets",
  "vêtements",
  "livres",
  "électroménager",
  "outillage",
  "instrument de musique",
];

const STEP_LABELS = ["Informations", "Photos", "Ce que je recherche", "Publication"];

interface PublishViewProps {
  editId?: string | null;
}

export default function PublishView({ editId }: PublishViewProps) {
  const navigate = useRouter((s) => s.navigate);
  const refresh = useAuth((s) => s.refresh);

  // ---------- État du wizard ----------
  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<"form" | "pay" | "wait" | "done">("form");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [condition, setCondition] = useState("");
  const [city, setCity] = useState("");
  const [quartier, setQuartier] = useState("");
  const [wantedText, setWantedText] = useState("");
  const [wantedCategory, setWantedCategory] = useState("");
  const [wantedMultiple, setWantedMultiple] = useState(false);
  const [images, setImages] = useState<WizardImages[]>([]);

  // ---------- Référentiels ----------
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [cities, setCities] = useState<CityItem[]>([]);
  const [payConfig, setPayConfig] = useState<PaymentConfig | null>(null);

  // ---------- Téléversement ----------
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- Soumission / édition ----------
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId));
  const [submitting, setSubmitting] = useState(false);
  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);
  const [listingRef, setListingRef] = useState<string | null>(null);

  // ---------- Paiement ----------
  const [provider, setProvider] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  const [instructions, setInstructions] = useState("");
  const [initiating, setInitiating] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [finalStatus, setFinalStatus] = useState<string>("PUBLISHED");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTicksRef = useRef(0);

  // ---------- Chargements initiaux ----------
  useEffect(() => {
    (async () => {
      try {
        const [cats, cts, cfg] = await Promise.all([
          api.get<{ categories: CategoryNode[] }>("/api/categories"),
          api.get<{ cities: CityItem[] }>("/api/cities"),
          api.get<PaymentConfig>("/api/payments/config"),
        ]);
        setCategories(cats.categories);
        setCities(cts.cities);
        setPayConfig(cfg);
      } catch {
        toast.error("Impossible de charger les référentiels. Rechargez la page.");
      }
    })();
  }, []);

  // Pré-remplissage en mode édition
  useEffect(() => {
    if (!editId) return;
    let mounted = true;
    (async () => {
      try {
        const res = await api.get<{
          listing: {
            id: string;
            reference: string;
            title: string;
            description: string;
            condition: string;
            city: string;
            quartier: string | null;
            wantedText: string;
            wantedCategory: string | null;
            wantedMultiple: boolean;
            status: string;
            category: { id: string } | null;
            subcategory: { id: string } | null;
            images: { url: string; isPrimary: boolean }[];
          };
        }>(`/api/listings/${editId}`);
        if (!mounted) return;
        const l = res.listing;
        setTitle(l.title);
        setDescription(l.description);
        setCategoryId(l.category?.id ?? "");
        setSubcategoryId(l.subcategory?.id ?? "");
        setCondition(l.condition);
        setCity(l.city);
        setQuartier(l.quartier ?? "");
        setWantedText(l.wantedText);
        setWantedCategory(l.wantedCategory ?? "");
        setWantedMultiple(l.wantedMultiple);
        setImages(l.images.map((i) => ({ url: i.url, isPrimary: i.isPrimary })));
        setListingId(l.id);
        setListingRef(l.reference);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Annonce introuvable");
        navigate("my-listings");
      } finally {
        if (mounted) setLoadingEdit(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [editId, navigate]);

  // Nettoyage du polling
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;

  // ---------- Validation par étape ----------
  function validateStep(s: number): Record<string, string> {
    const errors: Record<string, string> = {};
    if (s === 1) {
      if (title.trim().length < 5) errors.title = "Le titre doit contenir au moins 5 caractères";
      if (description.trim().length < 20)
        errors.description = "La description doit contenir au moins 20 caractères";
      if (!categoryId) errors.categoryId = "Choisissez une catégorie";
      if (!condition) errors.condition = "Indiquez l'état de l'objet";
      if (!city) errors.city = "Choisissez une ville";
    }
    if (s === 3) {
      if (wantedText.trim().length < 3)
        errors.wantedText = "Précisez ce que vous recherchez (3 caractères minimum)";
    }
    return errors;
  }

  function goToStep(s: number) {
    if (s > step) {
      const errors = validateStep(step);
      if (Object.keys(errors).length > 0) {
        setFields(errors);
        return;
      }
    }
    setFields(null);
    setStep(s);
  }

  // ---------- Corps envoyé à l'API ----------
  function buildPayload(saveAsDraft: boolean) {
    return {
      title: title.trim(),
      description: description.trim(),
      categoryId,
      subcategoryId: subcategoryId || undefined,
      condition: condition as (typeof CONDITIONS)[number]["value"],
      city,
      quartier: quartier.trim() || undefined,
      wantedText: wantedText.trim(),
      wantedCategory: wantedCategory || undefined,
      wantedMultiple,
      images: images.map((i) => ({ url: i.url, isPrimary: i.isPrimary })),
      saveAsDraft,
    };
  }

  async function handleSaveDraft() {
    setSubmitting(true);
    setFields(null);
    try {
      if (editId && listingId) {
        await api.patch(`/api/listings/${listingId}`, buildPayload(true));
        toast.success("Annonce enregistrée dans vos brouillons");
      } else {
        await api.post("/api/listings", buildPayload(true));
        toast.success("Annonce enregistrée dans vos brouillons");
      }
      navigate("my-listings");
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFields(error.fields ?? null);
        toast.error(error.message);
      } else {
        toast.error("Enregistrement impossible");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProceedPayment() {
    setSubmitting(true);
    setFields(null);
    try {
      if (editId && listingId) {
        const res = await api.patch<{ listing: { id: string; reference: string; status: string } }>(
          `/api/listings/${listingId}`,
          buildPayload(false)
        );
        setListingRef(res.listing?.reference ?? listingRef);
        if (res.listing && ["PUBLISHED", "EXCHANGED", "DEACTIVATED"].includes(res.listing.status)) {
          setFinalStatus(res.listing.status);
          setPhase("done");
          await refresh();
          return;
        }
        setPhase("pay");
      } else {
        const res = await api.post<{ listing: { id: string; reference: string; status: string } }>(
          "/api/listings",
          buildPayload(false)
        );
        setListingId(res.listing.id);
        setListingRef(res.listing.reference);
        setPhase("pay");
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFields(error.fields ?? null);
        toast.error(error.message);
      } else {
        toast.error("Enregistrement impossible");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Téléversement des photos ----------
  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    if (images.length + list.length > 6) {
      toast.error("Maximum 6 photos par annonce.");
      return;
    }
    setUploading(true);
    try {
      for (const file of list) {
        if (!file.type.startsWith("image/")) {
          toast.error(`« ${file.name} » n'est pas une image.`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`« ${file.name} » dépasse 5 Mo. Réduisez la taille du fichier.`);
          continue;
        }
        const compressed = await compressImage(file);
        const fd = new FormData();
        fd.append("files", compressed);
        const res = await api.upload<{ urls: string[] }>("/api/upload", fd);
        setImages((prev) =>
          [...prev, ...res.urls.map((url) => ({ url, isPrimary: false }))].slice(0, 6)
        );
      }
      toast.success("Photos ajoutées");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Téléversement impossible");
    } finally {
      setUploading(false);
    }
  }

  function setPrimary(url: string) {
    setImages((prev) => prev.map((i) => ({ ...i, isPrimary: i.url === url })));
  }

  function removeImage(url: string) {
    setImages((prev) => {
      const next = prev.filter((i) => i.url !== url);
      if (next.length > 0 && !next.some((i) => i.isPrimary)) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
  }

  // ---------- Paiement ----------
  async function handleInitiatePayment() {
    if (!listingId) return;
    if (!provider) {
      toast.error("Choisissez un moyen de paiement");
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 9) {
      toast.error("Saisissez un numéro de téléphone valide");
      return;
    }

    setInitiating(true);
    try {
      const res = await api.post<{
        payment: { reference: string; amount: number; status: string; provider: string };
        instructions: string;
      }>("/api/payments/initiate", { listingId, provider, phone: phone.trim() });
      setPaymentRef(res.payment.reference);
      setPaymentAmount(res.payment.amount);
      setInstructions(res.instructions);
      setPhase("wait");
      startPolling(res.payment.reference);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Paiement impossible");
    } finally {
      setInitiating(false);
    }
  }

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const finishPayment = useCallback(
    async (knownStatus?: string) => {
      stopPolling();
      let resolved = knownStatus ?? "";
      if (!resolved && listingId) {
        try {
          const detail = await api.get<{ listing: { status: string } }>(`/api/listings/${listingId}`);
          resolved = detail.listing.status;
        } catch {
          resolved = "PENDING_MODERATION";
        }
      }
      setFinalStatus(resolved || "PUBLISHED");
      setPhase("done");
      await refresh();
    },
    [listingId, refresh, stopPolling]
  );

  function startPolling(reference: string) {
    pollTicksRef.current = 0;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      pollTicksRef.current += 1;
      if (pollTicksRef.current > 40) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        toast.error("Le paiement n'a pas été confirmé dans le délai imparti (2 minutes).");
        return;
      }
      try {
        const res = await api.get<{ payment: { status: string } }>(
          `/api/payments/${reference}`
        );
        if (res.payment.status === "SUCCESS") {
          await finishPayment();
        } else if (res.payment.status === "FAILED" || res.payment.status === "EXPIRED") {
          stopPolling();
          toast.error("Le paiement a échoué. Vous pouvez réessayer.");
          setPhase("pay");
        }
      } catch {
        // Erreur passagère : on retente au prochain cycle
      }
    }, 3000);
  }

  async function handleSimulateConfirm() {
    if (!paymentRef) return;
    setSimulating(true);
    try {
      const res = await api.post<{ listingStatus: string; message: string }>(
        "/api/payments/test-confirm",
        { reference: paymentRef }
      );
      toast.success(res.message ?? "Paiement confirmé");
      await finishPayment(res.listingStatus ?? "PUBLISHED");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Confirmation impossible");
    } finally {
      setSimulating(false);
    }
  }

  // ---------- Listes avec valeur conservée ----------
  const cityOptions = useMemo(() => {
    const names = cities.map((c) => c.name);
    const extra = city && !names.includes(city) ? [city] : [];
    return [...extra, ...names];
  }, [cities, city]);

  const wantedOptions = useMemo(() => {
    const names = categories.map((c) => c.name);
    const extra = wantedCategory && !names.includes(wantedCategory) ? [wantedCategory] : [];
    return [...extra, ...names];
  }, [categories, wantedCategory]);

  const fee = payConfig?.fee ?? 500;

  // ---------- Rendu ----------

  if (loadingEdit) {
    return (
      <AccountShell active="publish" title={editId ? "Modifier mon annonce" : "Publier un article"}>
        <div className="flex flex-col items-center gap-3 py-20" role="status">
          <Loader2 className="animate-spin text-forest-600" size={28} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Chargement de l&apos;annonce…</p>
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell
      active="publish"
      title={editId ? "Modifier mon annonce" : "Publier un article"}
    >
      {/* Barre de progression (étapes 1 à 4) */}
      {phase !== "done" && (
        <ol
          className="mb-6 flex items-start"
          aria-label="Progression de la publication"
        >
          {STEP_LABELS.map((label, idx) => {
            const n = idx + 1;
            const done = phase !== "form" || step > n;
            const active = phase === "form" && step === n;
            return (
              <li key={label} className={cn("flex items-start", idx < STEP_LABELS.length - 1 && "flex-1")}>
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors",
                      done
                        ? "bg-emerald-brand-500 text-white"
                        : active
                          ? "border-2 border-emerald-brand-500 bg-white text-emerald-brand-600"
                          : "bg-gray-200 text-gray-500"
                    )}
                  >
                    {done ? <Check size={16} aria-hidden="true" /> : n}
                  </span>
                  <span
                    className={cn(
                      "max-w-20 text-center text-[10px] leading-tight sm:max-w-none sm:text-xs",
                      active || done ? "font-semibold text-forest-700" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </div>
                {idx < STEP_LABELS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mx-2 mt-4 h-0.5 flex-1 rounded sm:mx-3",
                      done ? "bg-emerald-brand-500" : "bg-gray-200"
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* ============ PHASE FORMULAIRE ============ */}
      {phase === "form" && (
        <Card className="p-4 sm:p-6">
          {/* ---------- Étape 1 : Informations ---------- */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-up">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pub-title">Titre de l&apos;annonce</Label>
                  <span className="text-[11px] text-muted-foreground">{title.length}/100</span>
                </div>
                <Input
                  id="pub-title"
                  maxLength={100}
                  placeholder="Ex. Vélo VTT 26 pouces très bon état"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-invalid={Boolean(fields?.title)}
                  className="h-11"
                />
                {fields?.title && (
                  <p role="alert" className="text-xs font-medium text-red-600">{fields.title}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pub-description">Description détaillée</Label>
                  <span className="text-[11px] text-muted-foreground">{description.length}/3000</span>
                </div>
                <Textarea
                  id="pub-description"
                  maxLength={3000}
                  placeholder="Décrivez votre objet : marque, âge, défauts éventuels, raison de l'échange…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  aria-invalid={Boolean(fields?.description)}
                  className="min-h-32"
                />
                {fields?.description && (
                  <p role="alert" className="text-xs font-medium text-red-600">{fields.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pub-category">Catégorie</Label>
                  <Select
                    value={categoryId}
                    onValueChange={(v) => {
                      setCategoryId(v);
                      setSubcategoryId("");
                    }}
                  >
                    <SelectTrigger id="pub-category" aria-invalid={Boolean(fields?.categoryId)} className="h-11 w-full">
                      <SelectValue placeholder="Choisissez une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fields?.categoryId && (
                    <p role="alert" className="text-xs font-medium text-red-600">{fields.categoryId}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-subcategory">
                    Sous-catégorie <span className="text-muted-foreground">(facultatif)</span>
                  </Label>
                  <Select
                    value={subcategoryId}
                    onValueChange={setSubcategoryId}
                    disabled={!selectedCategory || (selectedCategory.children?.length ?? 0) === 0}
                  >
                    <SelectTrigger id="pub-subcategory" className="h-11 w-full">
                      <SelectValue
                        placeholder={
                          selectedCategory && (selectedCategory.children?.length ?? 0) > 0
                            ? "Précisez la sous-catégorie"
                            : "Aucune sous-catégorie"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedCategory?.children ?? []).map((ch) => (
                        <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">État de l&apos;objet</legend>
                <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                  {CONDITIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      aria-pressed={condition === c.value}
                      onClick={() => setCondition(c.value)}
                      className={cn(
                        "flex min-h-11 items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                        condition === c.value
                          ? "border-emerald-brand-500 bg-mint-50 text-forest-800"
                          : "border-border bg-white text-foreground/75 hover:border-forest-200 hover:bg-mint-50/50"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {fields?.condition && (
                  <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{fields.condition}</p>
                )}
              </fieldset>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pub-city">Ville</Label>
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger id="pub-city" aria-invalid={Boolean(fields?.city)} className="h-11 w-full">
                      <SelectValue placeholder="Choisissez une ville" />
                    </SelectTrigger>
                    <SelectContent>
                      {cityOptions.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fields?.city && (
                    <p role="alert" className="text-xs font-medium text-red-600">{fields.city}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-quartier">
                    Quartier <span className="text-muted-foreground">(facultatif)</span>
                  </Label>
                  <Input
                    id="pub-quartier"
                    placeholder="Ex. Ouakam, Fann…"
                    value={quartier}
                    onChange={(e) => setQuartier(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ---------- Étape 2 : Photos ---------- */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-up">
              <div
                role="button"
                tabIndex={0}
                aria-label="Zone de dépôt des photos"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void uploadFiles(e.dataTransfer.files);
                }}
                className={cn(
                  "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
                  dragging ? "border-emerald-brand-500 bg-mint-50" : "border-forest-200 bg-mint-50/50 hover:bg-mint-50"
                )}
              >
                {uploading ? (
                  <Loader2 className="animate-spin text-emerald-brand-500" size={32} aria-hidden="true" />
                ) : (
                  <CloudUpload className="text-forest-400" size={32} aria-hidden="true" />
                )}
                <p className="text-sm font-medium text-forest-700">
                  {uploading ? "Téléversement en cours…" : "Glissez vos photos ici ou cliquez pour parcourir"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Formats JPEG, PNG, WebP — 5 Mo max par photo. La première photo est la photo principale.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) void uploadFiles(e.target.files);
                    e.target.value = "";
                  }}
                  aria-label="Ajouter des photos"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || images.length >= 6}
                className="h-11"
              >
                <CloudUpload size={18} aria-hidden="true" />
                Ajouter des photos ({images.length}/6)
              </Button>

              {images.length > 0 && (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Photos de l'annonce">
                  {images.map((img) => (
                    <li key={img.url} className="group relative overflow-hidden rounded-xl border border-border/70 bg-muted">
                      <div className="relative aspect-square">
                        <Image src={img.url} alt="Photo de l'annonce" fill sizes="200px" className="object-cover" />
                        {img.isPrimary && (
                          <span className="absolute left-2 top-2 rounded-md bg-forest-700 px-2 py-0.5 text-[10px] font-bold text-white">
                            Principale
                          </span>
                        )}
                      </div>
                      <div className="absolute right-1.5 top-1.5 flex gap-1">
                        <button
                          type="button"
                          onClick={() => setPrimary(img.url)}
                          aria-label="Définir comme photo principale"
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full shadow-card transition-colors",
                            img.isPrimary ? "bg-mango-400 text-white" : "bg-white/95 text-gray-500 hover:text-mango-500"
                          )}
                        >
                          <Star size={14} className={img.isPrimary ? "fill-white" : ""} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(img.url)}
                          aria-label="Supprimer cette photo"
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-gray-500 shadow-card transition-colors hover:text-red-600"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ---------- Étape 3 : Ce que je recherche ---------- */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-up">
              <div className="space-y-1.5">
                <Label htmlFor="pub-wanted">Qu&apos;accepteriez-vous en échange ?</Label>
                <Input
                  id="pub-wanted"
                  maxLength={200}
                  placeholder="Ex. un ordinateur portable, un vélo pour enfant…"
                  value={wantedText}
                  onChange={(e) => setWantedText(e.target.value)}
                  aria-invalid={Boolean(fields?.wantedText)}
                  className="h-11"
                />
                {fields?.wantedText && (
                  <p role="alert" className="text-xs font-medium text-red-600">{fields.wantedText}</p>
                )}
                <p className="text-[11px] text-muted-foreground">{wantedText.length}/200</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {WANTED_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setWantedText(s.charAt(0).toUpperCase() + s.slice(1))}
                      className="rounded-full border border-forest-200 bg-mint-50 px-3 py-1.5 text-xs font-medium text-forest-700 transition-colors hover:bg-mint-100"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pub-wanted-category">Catégorie souhaitée (facultatif)</Label>
                <Select value={wantedCategory} onValueChange={(v) => setWantedCategory(v === "__none__" ? "" : v)}>
                  <SelectTrigger id="pub-wanted-category" className="h-11 w-full">
                    <SelectValue placeholder="Aucune catégorie précise" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucune catégorie précise</SelectItem>
                    {wantedOptions.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-mint-50/60 p-4">
                <div>
                  <p className="text-sm font-medium text-forest-800">
                    J&apos;accepte plusieurs types d&apos;objets en échange
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Coché, votre objet peut intéresser des membres avec des propositions variées.
                  </p>
                </div>
                <Switch
                  checked={wantedMultiple}
                  onCheckedChange={setWantedMultiple}
                  aria-label="Accepter plusieurs types d'objets en échange"
                />
              </div>
            </div>
          )}

          {/* ---------- Étape 4 : Récapitulatif ---------- */}
          {step === 4 && (
            <div className="space-y-5 animate-fade-up">
              <div className="rounded-2xl border border-border/70 p-4 sm:p-5">
                <h2 className="text-base font-semibold text-forest-800">Récapitulatif de votre annonce</h2>
                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Titre</dt>
                    <dd className="font-medium text-foreground">{title}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Catégorie</dt>
                    <dd className="font-medium text-foreground">
                      {selectedCategory?.name ?? "—"}
                      {subcategoryId
                        ? ` › ${selectedCategory?.children?.find((ch) => ch.id === subcategoryId)?.name ?? ""}`
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">État</dt>
                    <dd className="font-medium text-foreground">
                      {CONDITIONS.find((c) => c.value === condition)?.label ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Localisation</dt>
                    <dd className="font-medium text-foreground">
                      {city}
                      {quartier ? ` • ${quartier}` : ""}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Objet recherché en échange</dt>
                    <dd className="font-medium text-foreground">
                      {wantedText}
                      {wantedCategory ? ` (catégorie : ${wantedCategory})` : ""}
                      {wantedMultiple ? " — plusieurs types acceptés" : ""}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Photos</dt>
                    <dd className="font-medium text-foreground">
                      {images.length} photo{images.length > 1 ? "s" : ""}
                      {images.length === 0 ? " — aucune photo pour le moment" : ""}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Description</dt>
                    <dd className="text-foreground/85">
                      {description.length > 220 ? `${description.slice(0, 220)}…` : description}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-mint-200 bg-mint-100 p-4">
                <Info size={20} className="mt-0.5 shrink-0 text-forest-600" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-forest-800">
                    Frais de publication : {formatFCFA(fee)} par article
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-forest-700/80">
                    Ce montant couvre le service de publication et ne correspond en aucun cas au prix
                    ou à la valeur de l&apos;objet échangé.
                  </p>
                </div>
              </div>

              {fields && Object.keys(fields).length > 0 && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">
                  {Object.values(fields)[0]}
                </p>
              )}
            </div>
          )}

          {/* ---------- Navigation du wizard ---------- */}
          <Separator className="my-5" />
          <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-between">
            <div className="flex gap-2.5">
              {step === 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate("my-listings")}
                  className="h-11"
                >
                  Annuler
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={() => goToStep(step - 1)} className="h-11">
                  <ArrowLeft size={18} aria-hidden="true" />
                  Retour
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              {step === 4 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={submitting}
                  className="h-11"
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                  ) : (
                    <Save size={18} aria-hidden="true" />
                  )}
                  Enregistrer comme brouillon
                </Button>
              )}
              {step < 4 ? (
                <Button
                  type="button"
                  onClick={() => goToStep(step + 1)}
                  className="h-11 bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
                >
                  Continuer
                  <ArrowRight size={18} aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleProceedPayment}
                  disabled={submitting}
                  className="h-11 bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                  ) : (
                    <PackagePlus size={18} aria-hidden="true" />
                  )}
                  {editId ? "Enregistrer et procéder au paiement" : "Procéder au paiement"}
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ============ PHASE PAIEMENT (choix du prestataire) ============ */}
      {phase === "pay" && (
        <Card className="p-4 sm:p-6 animate-fade-up">
          <h2 className="text-lg font-bold text-forest-800">Paiement des frais de publication</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Référence <span className="font-mono font-semibold text-forest-700">{listingRef}</span> —
            montant à régler :{" "}
            <span className="font-semibold text-forest-700">{formatFCFA(fee)}</span>
          </p>

          <fieldset className="mt-5">
            <legend className="mb-2.5 text-sm font-medium">Choisissez votre moyen de paiement</legend>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {(payConfig?.providers ?? []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={provider === p.id}
                  onClick={() => setProvider(p.id)}
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
                    provider === p.id
                      ? "border-emerald-brand-500 bg-mint-50"
                      : "border-border bg-white hover:border-forest-200"
                  )}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: p.color }}
                    aria-hidden="true"
                  >
                    {p.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 max-w-sm space-y-1.5">
            <Label htmlFor="pay-phone">Numéro de téléphone du compte</Label>
            <Input
              id="pay-phone"
              type="tel"
              placeholder="+221 77 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11"
            />
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPhase("form")}
              className="h-11"
            >
              <ArrowLeft size={18} aria-hidden="true" />
              Retour à l&apos;annonce
            </Button>
            <Button
              type="button"
              onClick={handleInitiatePayment}
              disabled={initiating}
              className="h-11 bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
            >
              {initiating ? (
                <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              ) : (
                <Banknote size={18} aria-hidden="true" />
              )}
              Payer {formatFCFA(fee)}
            </Button>
          </div>
        </Card>
      )}

      {/* ============ PHASE ATTENTE ============ */}
      {phase === "wait" && (
        <Card className="p-6 text-center sm:p-8 animate-fade-up">
          <Loader2 className="mx-auto animate-spin text-emerald-brand-500" size={44} aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold text-forest-800">Paiement en attente de confirmation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Transaction <span className="font-mono font-semibold text-forest-700">{paymentRef}</span> —
            montant : <span className="font-semibold text-forest-700">{formatFCFA(paymentAmount ?? fee)}</span>
          </p>
          {instructions && (
            <p className="mx-auto mt-3 max-w-md rounded-lg bg-mint-50 p-3 text-xs leading-relaxed text-forest-700">
              {instructions}
            </p>
          )}

          <div
            role="status"
            className="mx-auto mt-4 flex max-w-md items-start gap-3 rounded-xl border border-mango-300 bg-mango-100 p-4 text-left"
          >
            <Clock size={20} className="mt-0.5 shrink-0 text-mango-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-mango-700">Mode test</p>
              <p className="mt-0.5 text-xs leading-relaxed text-mango-700/90">
                Mode test — aucun paiement réel n&apos;est débité. En production, vous confirmeriez
                le paiement dans votre application Wave / Orange Money.
              </p>
              <Button
                type="button"
                onClick={handleSimulateConfirm}
                disabled={simulating}
                className="mt-3 h-11 w-full bg-mango-500 text-white hover:bg-mango-600 sm:w-auto"
              >
                {simulating ? (
                  <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={18} aria-hidden="true" />
                )}
                Simuler la confirmation (mode test)
              </Button>
            </div>
          </div>

          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Nous vérifions automatiquement le statut du paiement toutes les 3 secondes.
          </p>
        </Card>
      )}

      {/* ============ PHASE SUCCÈS ============ */}
      {phase === "done" && (
        <Card className="p-6 text-center sm:p-10 animate-fade-up">
          <CheckCircle2 className="mx-auto text-emerald-brand-500" size={56} aria-hidden="true" />
          <h2 className="mt-4 flex items-center justify-center gap-2 text-xl font-bold text-forest-800 sm:text-2xl">
            {finalStatus === "PUBLISHED" ? (
              <>Votre annonce est en ligne !</>
            ) : finalStatus === "PENDING_MODERATION" ? (
              <>Votre annonce est en attente de validation par la modération</>
            ) : (
              <>Votre annonce a été enregistrée</>
            )}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {finalStatus === "PUBLISHED"
              ? "Elle est désormais visible par toute la communauté SamaTroc. Vous serez notifié dès qu'un membre vous fera une proposition."
              : "Notre équipe vérifie le contenu de votre annonce, généralement sous 24 heures. Vous recevrez une notification dès sa mise en ligne."}
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <PartyPopper size={14} className="text-mango-500" aria-hidden="true" />
            Merci de faire vivre l&apos;économie circulaire au Sénégal.
          </div>

          <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Button
              type="button"
              onClick={() => navigate("my-listings")}
              className="h-11 bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
            >
              <FileText size={18} aria-hidden="true" />
              Voir mes annonces
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("home")} className="h-11">
              Retour à l&apos;accueil
            </Button>
          </div>
        </Card>
      )}
    </AccountShell>
  );
}
