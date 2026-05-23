import React from "react";
import { Smartphone } from "lucide-react";

export default function FreeAppBanner({ variant }) {
  if (variant === "hero") {
    return (
      <div className="bg-[#1F4E3D] text-white py-2 px-4 text-center text-xs font-medium flex items-center justify-center gap-2">
        <Smartphone className="w-4 h-4 animate-bounce" />
        <span>
          Kaba-Compta Togo est bientôt disponible sur Android ! Suivez vos ventes même hors-ligne.
        </span>
      </div>
    );
  }
  return null;
}
