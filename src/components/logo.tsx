import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "default" | "light";
  size?: "sm" | "md" | "lg";
  showSlogan?: boolean;
}

/**
 * Logo SamaTroc : deux flèches (verte et orange) symbolisant l'échange
 * et la circulation des objets. "Sama" en vert foncé, "Troc" en orange.
 */
export function Logo({
  className,
  variant = "default",
  size = "md",
  showSlogan = true,
}: LogoProps) {
  const markSize = size === "sm" ? 28 : size === "lg" ? 44 : 36;
  const titleSize =
    size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl";
  const sloganSize = size === "sm" ? "text-[8px]" : "text-[9px]";

  const samaColor = variant === "light" ? "text-white" : "text-forest-700";
  const sloganColor = variant === "light" ? "text-white/80" : "text-forest-600";

  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Flèche verte (haut) */}
        <path
          d="M7 24a17 17 0 0 1 17-17 18.5 18.5 0 0 1 12.8 5.2L41 16"
          stroke="#0e5c3d"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M41.5 6.5v10h-10"
          stroke="#0e5c3d"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Flèche orange (bas) */}
        <path
          d="M41 24a17 17 0 0 1-17 17 18.5 18.5 0 0 1-12.8-5.2L7 32"
          stroke="#f59e0b"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.5 41.5v-10h10"
          stroke="#f59e0b"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex flex-col leading-none">
        <span className={cn("font-extrabold tracking-tight", titleSize, samaColor)}>
          Sama<span className="text-mango-500">Troc</span>
        </span>
        {showSlogan && (
          <span className={cn("font-medium mt-1 tracking-wide", sloganSize, sloganColor)}>
            Échangez • Économisez • Donnez une seconde vie
          </span>
        )}
      </div>
    </div>
  );
}

/** Marque seule (favicon, icônes) */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M7 24a17 17 0 0 1 17-17 18.5 18.5 0 0 1 12.8 5.2L41 16"
        stroke="#0e5c3d"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M41.5 6.5v10h-10"
        stroke="#0e5c3d"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M41 24a17 17 0 0 1-17 17 18.5 18.5 0 0 1-12.8-5.2L7 32"
        stroke="#f59e0b"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 41.5v-10h10"
        stroke="#f59e0b"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
