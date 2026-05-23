import React from "react";
import { useNavigate } from "react-router-dom";
import { Eye, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function ImpersonationBanner() {
  const { impersonating, user, endImpersonation } = useAuth();
  const navigate = useNavigate();

  if (!impersonating || !user) return null;

  const handleEnd = async () => {
    try {
      await endImpersonation();
      toast.success("Retour au compte admin");
      navigate("/admin/users");
    } catch {
      toast.error("Erreur, déconnexion forcée");
    }
  };

  return (
    <div
      className="sticky top-0 z-50 bg-[#ECA869] text-[#2D2D2D] border-b-2 border-[#1F4E3D]"
      data-testid="impersonation-banner"
    >
      <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="w-4 h-4 flex-shrink-0" />
          <div className="text-sm min-w-0">
            <span className="font-bold">Mode admin :</span>{" "}
            <span className="truncate">vue en tant que {user.display_name}</span>
          </div>
        </div>
        <button
          onClick={handleEnd}
          data-testid="end-impersonation-btn"
          className="flex items-center gap-1 bg-[#1F4E3D] text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-[#163328] flex-shrink-0"
        >
          <ArrowLeft className="w-3 h-3" /> Retour admin
        </button>
      </div>
    </div>
  );
}
