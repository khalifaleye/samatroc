import type { Metadata, Viewport } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const poppins = Poppins({
  variable: "--font-samatroc",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "SamaTroc - Échangez vos articles en toute simplicité",
    template: "%s | SamaTroc",
  },
  description:
    "SamaTroc est la plateforme sénégalaise d'échange d'objets entre particuliers. Donnez une seconde vie à ce que vous n'utilisez plus et trouvez ce dont vous avez besoin. Échangez, économisez, donnez une seconde vie.",
  keywords: [
    "SamaTroc",
    "troc",
    "échange",
    "Sénégal",
    "Dakar",
    "seconde vie",
    "économie circulaire",
    "annonces",
    "particuliers",
  ],
  authors: [{ name: "SamaTroc" }],
  applicationName: "SamaTroc",
  openGraph: {
    title: "SamaTroc - Échangez vos articles en toute simplicité",
    description:
      "La plateforme qui permet d'échanger des objets entre particuliers au Sénégal. Échangez • Économisez • Donnez une seconde vie.",
    type: "website",
    locale: "fr_SN",
    siteName: "SamaTroc",
    images: [{ url: "/images/hero.png", width: 1440, height: 720, alt: "SamaTroc" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SamaTroc - Échangez vos articles en toute simplicité",
    description:
      "La plateforme sénégalaise d'échange d'objets entre particuliers. Échangez • Économisez • Donnez une seconde vie.",
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.json",
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#0e5c3d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
