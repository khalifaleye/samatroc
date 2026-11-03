import {
  Shirt,
  Smartphone,
  Home,
  Flower2,
  Trophy,
  BookOpen,
  Baby,
  Armchair,
  LayoutGrid,
  Package,
  Sofa,
  Wrench,
  ShoppingBag,
  Bike,
  Watch,
  Headphones,
  Camera,
  Gamepad2,
  Palette,
  Music,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  shirt: Shirt,
  smartphone: Smartphone,
  home: Home,
  flower: Flower2,
  trophy: Trophy,
  book: BookOpen,
  baby: Baby,
  armchair: Armchair,
  grid: LayoutGrid,
  package: Package,
  sofa: Sofa,
  wrench: Wrench,
  bag: ShoppingBag,
  bike: Bike,
  watch: Watch,
  headphones: Headphones,
  camera: Camera,
  gamepad: Gamepad2,
  palette: Palette,
  music: Music,
};

export const CATEGORY_ICON_NAMES = Object.keys(ICONS);

interface CategoryIconProps {
  icon: string;
  color?: string;
  className?: string;
  size?: number;
}

/** Icône de catégorie par nom (lucide) avec couleur personnalisée */
export function CategoryIcon({ icon, color, className, size = 24 }: CategoryIconProps) {
  const Icon = ICONS[icon] ?? Package;
  return (
    <Icon
      className={cn(className)}
      size={size}
      style={color ? { color } : undefined}
      aria-hidden="true"
    />
  );
}
