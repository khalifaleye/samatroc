"use client";

import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";
import { useRouter } from "@/stores/router-store";

/** Page 404 : vue introuvable */
export function ViewNotFound() {
  const navigate = useRouter((s) => s.navigate);

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="h-24 w-24 rounded-full bg-mint-50 flex items-center justify-center mb-6">
        <FileQuestion className="text-forest-600" size={44} aria-hidden="true" />
      </div>
      <h1 className="text-5xl font-extrabold text-forest-800 mb-3">404</h1>
      <h2 className="text-xl font-semibold mb-2">Page introuvable</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        La page que vous recherchez n&apos;existe pas ou a été déplacée.
        Vérifiez l&apos;adresse ou retournez à l&apos;accueil pour continuer vos échanges.
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <Button onClick={() => navigate("home")} className="bg-forest-700 hover:bg-forest-800 rounded-full px-6">
          Retour à l&apos;accueil
        </Button>
        <Button onClick={() => navigate("explore")} variant="outline" className="rounded-full px-6">
          Voir les annonces
        </Button>
      </div>
    </div>
  );
}
