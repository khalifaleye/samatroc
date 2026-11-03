"use client";

import { Facebook, Instagram, Youtube, MessageCircle, Music2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { useRouter } from "@/stores/router-store";

/** Drapeau du Sénégal (SVG) : vert, jaune, rouge + étoile verte */
export function SenegalFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="10" height="20" fill="#00853F" />
      <rect x="10" width="10" height="20" fill="#FDEF42" />
      <rect x="20" width="10" height="20" fill="#E31B23" />
      <path
        d="M15 6.2l1.1 2.9 3 .15-2.35 1.9.8 2.95L15 12.4l-2.55 1.7.8-2.95-2.35-1.9 3-.15z"
        fill="#00853F"
      />
    </svg>
  );
}

const SOCIAL_LINKS = [
  { name: "Facebook", icon: Facebook, url: "https://facebook.com/samatroc" },
  { name: "WhatsApp", icon: MessageCircle, url: "https://wa.me/221770000000" },
  { name: "Instagram", icon: Instagram, url: "https://instagram.com/samatroc" },
  { name: "TikTok", icon: Music2, url: "https://tiktok.com/@samatroc" },
  { name: "YouTube", icon: Youtube, url: "https://youtube.com/@samatroc" },
];

export function Footer() {
  const navigate = useRouter((s) => s.navigate);
  const year = new Date().getFullYear();

  const linkGroups: { title: string; links: { label: string; view: string; params?: Record<string, string> }[] }[] = [
    {
      title: "Plateforme",
      links: [
        { label: "À propos", view: "about" },
        { label: "Comment ça marche ?", view: "how-it-works" },
        { label: "Toutes les annonces", view: "explore" },
        { label: "Toutes les catégories", view: "categories" },
      ],
    },
    {
      title: "Aide",
      links: [
        { label: "FAQ", view: "faq" },
        { label: "Contact & assistance", view: "contact" },
        { label: "Conseils de sécurité", view: "safety" },
      ],
    },
    {
      title: "Légal",
      links: [
        { label: "Conditions d'utilisation", view: "cgu" },
        { label: "Politique de confidentialité", view: "privacy" },
        { label: "Politique de modération", view: "moderation" },
      ],
    },
  ];

  return (
    <footer className="mt-auto bg-forest-950 text-white" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 md:py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          {/* Logo + description */}
          <div className="md:col-span-4 space-y-4">
            <Logo variant="light" size="md" />
            <p className="text-sm text-white/70 leading-relaxed max-w-xs">
              La plateforme sénégalaise d&apos;échange d&apos;objets entre particuliers.
              Donnez une seconde vie à ce que vous n&apos;utilisez plus.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/60">Suivez-nous</span>
              <div className="flex items-center gap-2">
                {SOCIAL_LINKS.map((social) => (
                  <a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`SamaTroc sur ${social.name}`}
                    className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <social.icon size={16} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Groupes de liens */}
          {linkGroups.map((group) => (
            <nav key={group.title} className="md:col-span-2" aria-label={group.title}>
              <h3 className="text-sm font-semibold text-white/90 mb-3">{group.title}</h3>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => navigate(link.view, link.params)}
                      className="text-sm text-white/65 hover:text-white transition-colors text-left"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Sénégal */}
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-white/90 mb-3">Pays</h3>
            <button
              className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors"
              aria-label="Pays : Sénégal"
            >
              <SenegalFlag className="w-6 h-4 rounded-[2px] shadow-sm" />
              Sénégal
            </button>
            <p className="text-xs text-white/50 mt-3 leading-relaxed">
              Français • FCFA<br />Fuseau : Africa/Dakar
            </p>
          </div>
        </div>
      </div>

      {/* Barre inférieure */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-white/55">
            © {year} SamaTroc. Tous droits réservés.
          </p>
          <p className="text-xs text-white/55">
            Une initiative sénégalaise pour un avenir plus durable.
          </p>
        </div>
      </div>
    </footer>
  );
}
