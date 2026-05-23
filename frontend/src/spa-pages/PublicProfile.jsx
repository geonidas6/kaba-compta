import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { User, Star, ShieldCheck, MapPin, Calendar, Share2, Copy, Sparkles, Briefcase, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function PublicProfile() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const r = await api.get(`/users/${userId}/public-profile`);
      setData(r.data);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.detail || "Profil introuvable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-[#C84B31] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-[#6C6C6C] font-semibold">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAF8F5]">
        <header className="border-b border-[#EAE5D9] bg-white">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#C84B31] text-white grid place-items-center font-bold">K</div>
              <span className="font-extrabold text-lg">Kaba-Compta</span>
            </Link>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="card-flat p-6 max-w-sm w-full text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full grid place-items-center mx-auto text-xl font-bold">!</div>
            <h2 className="font-bold text-lg text-[#2D2D2D]">Profil introuvable</h2>
            <p className="text-sm text-[#6C6C6C]">{error || "Cet utilisateur n'existe pas ou son compte a été désactivé."}</p>
            <Link to="/" className="inline-block w-full">
              <Button className="w-full bg-[#1F4E3D] hover:bg-[#16372B]">Retour à l'accueil</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { user, reviews, avg_rating, reviews_count, missions_count } = data;
  const isAssistant = user.role === "assistant";
  
  const shareUrl = window.location.href;
  const shareText = `Découvrez le profil de ${user.display_name} (${isAssistant ? "Freelance Comptable" : "Commerçant"}) sur Kaba-Compta Togo !`;

  const shareOnWhatsapp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`, "_blank");
  };

  const shareOnFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank");
  };

  const shareOnLinkedin = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, "_blank");
  };

  const shareOnTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Lien copié dans le presse-papiers !");
  };

  const renderStars = (rating) => {
    const rounded = Math.round(rating);
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-4 h-4 ${
              s <= rounded ? "fill-[#ECA869] text-[#ECA869]" : "text-[#EAE5D9] fill-transparent"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D2D2D] flex flex-col">
      {/* Public Header */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur border-b border-[#EAE5D9]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#C84B31] text-white grid place-items-center font-bold font-['Manrope']">
              K
            </div>
            <span className="font-['Manrope'] font-extrabold text-lg">Kaba-Compta</span>
          </Link>
          <div className="flex items-center gap-3">
            {currentUser ? (
              <Link to={currentUser.role === "assistant" ? "/app/assistant" : "/app/dashboard"}>
                <Button variant="outline" className="border-[#1F4E3D] text-[#1F4E3D] hover:bg-[#1F4E3D] hover:text-white rounded-full px-4 text-xs font-semibold">
                  Mon Tableau de bord
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth?tab=login">
                  <Button variant="ghost" className="text-sm font-semibold hover:text-[#C84B31]">
                    Connexion
                  </Button>
                </Link>
                <Link to="/auth?tab=register">
                  <Button className="bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-full px-5 text-xs font-semibold">
                    S'inscrire
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
        
        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-[#EAE5D9] shadow-sm overflow-hidden">
          {/* Cover Photo Banner */}
          <div className="h-32 sm:h-40 bg-gradient-to-r from-[#1F4E3D] via-[#2A6650] to-[#ECA869]/70 relative">
            {user.is_premium && (
              <div className="absolute right-4 top-4 bg-[#ECA869] text-[#1F4E3D] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow">
                <Sparkles className="w-3 h-3 fill-current" /> Premium
              </div>
            )}
          </div>

          {/* Profile details block */}
          <div className="px-6 pb-6 pt-0 relative flex flex-col sm:flex-row sm:items-end gap-5">
            {/* Avatar overlapping cover */}
            <div className="-mt-16 relative z-10 shrink-0">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border-4 border-white shadow"
                />
              ) : (
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-[#1F4E3D] text-white font-['Manrope'] font-bold text-4xl grid place-items-center border-4 border-white shadow">
                  {user.display_name?.[0]?.toUpperCase()}
                </div>
              )}
            </div>

            {/* User Title & Info */}
            <div className="flex-1 min-w-0 pt-2 sm:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-['Manrope'] font-extrabold text-2xl sm:text-3xl tracking-tight leading-tight">
                  {user.display_name}
                </h1>
                {user.kyc_status === "verified" && (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Vérifié OTR/CNSS
                  </span>
                )}
              </div>

              {/* Shop info or role */}
              <div className="mt-1 text-sm text-[#6C6C6C] font-medium flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                  isAssistant ? "bg-[#1F4E3D]/10 text-[#1F4E3D]" : "bg-[#C84B31]/10 text-[#C84B31]"
                }`}>
                  {isAssistant ? "Assistant Comptable" : "Commerçant"}
                </span>
                {user.shop_name && (
                  <>
                    <span>•</span>
                    <span className="font-bold text-[#2D2D2D]">{user.shop_name}</span>
                  </>
                )}
                {user.city && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-0.5"><MapPin className="w-3.5 h-3.5 shrink-0" /> {user.city}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column: Stats & Share */}
          <div className="space-y-6">
            
            {/* Stats Card */}
            <div className="bg-white p-5 rounded-2xl border border-[#EAE5D9] shadow-sm space-y-4">
              <h3 className="font-['Manrope'] font-bold text-lg border-b border-[#EAE5D9]/60 pb-2">Statistiques</h3>
              <div className="grid grid-cols-3 md:grid-cols-1 gap-4">
                <div className="p-3 bg-[#FAF8F5] rounded-xl text-center md:text-left">
                  <div className="text-2xl font-extrabold text-[#C84B31]">{missions_count}</div>
                  <div className="text-xs text-[#6C6C6C] font-semibold mt-0.5">
                    {isAssistant ? "Projets réalisés" : "Missions publiées"}
                  </div>
                </div>

                <div className="p-3 bg-[#FAF8F5] rounded-xl text-center md:text-left">
                  <div className="text-2xl font-extrabold text-[#1F4E3D] flex items-baseline justify-center md:justify-start gap-1">
                    {avg_rating}
                    <span className="text-xs text-[#6C6C6C] font-normal">/ 5</span>
                  </div>
                  <div className="text-xs text-[#6C6C6C] font-semibold mt-0.5 flex justify-center md:justify-start">
                    {renderStars(avg_rating)}
                  </div>
                </div>

                <div className="p-3 bg-[#FAF8F5] rounded-xl text-center md:text-left">
                  <div className="text-2xl font-extrabold text-[#ECA869]">{reviews_count}</div>
                  <div className="text-xs text-[#6C6C6C] font-semibold mt-0.5">Avis reçus</div>
                </div>
              </div>

              {/* Direct call to action button */}
              <div className="pt-2">
                {currentUser ? (
                  <Link to={isAssistant ? "/app/missions/create" : "/app/missions"} className="block w-full">
                    <Button className="w-full h-11 bg-[#1F4E3D] hover:bg-[#16372B] text-white rounded-xl text-xs font-bold">
                      {isAssistant ? "Recruter cet assistant" : "Consulter les missions"}
                    </Button>
                  </Link>
                ) : (
                  <Link to={`/auth?redirect=${encodeURIComponent(isAssistant ? "/app/missions/create" : "/app/missions")}`} className="block w-full">
                    <Button className="w-full h-11 bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-xl text-xs font-bold">
                      {isAssistant ? "Proposer une mission" : "Postuler à ses offres"}
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Sharing Widget */}
            <div className="bg-white p-5 rounded-2xl border border-[#EAE5D9] shadow-sm space-y-4">
              <h3 className="font-['Manrope'] font-bold text-lg border-b border-[#EAE5D9]/60 pb-2 flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-[#C84B31]" /> Partager le profil
              </h3>
              <p className="text-xs text-[#6C6C6C]">Partagez cette fiche sur les réseaux sociaux pour faire connaître son profil.</p>
              
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={shareOnWhatsapp}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 font-bold transition flex items-center justify-between text-xs cursor-pointer"
                >
                  <span>Partager sur WhatsApp</span>
                  <span className="text-[10px] bg-[#25D366] text-white px-2 py-0.5 rounded">Actif</span>
                </button>
                <button
                  type="button"
                  onClick={shareOnFacebook}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 font-bold transition flex items-center justify-between text-xs cursor-pointer"
                >
                  <span>Partager sur Facebook</span>
                  <span className="text-[10px] bg-[#1877F2] text-white px-2 py-0.5 rounded">Partager</span>
                </button>
                <button
                  type="button"
                  onClick={shareOnLinkedin}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2]/20 font-bold transition flex items-center justify-between text-xs cursor-pointer"
                >
                  <span>Partager sur LinkedIn</span>
                  <span className="text-[10px] bg-[#0A66C2] text-white px-2 py-0.5 rounded">Pro</span>
                </button>
                <button
                  type="button"
                  onClick={shareOnTwitter}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#2D2D2D]/10 text-[#2D2D2D] hover:bg-[#2D2D2D]/20 font-bold transition flex items-center justify-between text-xs cursor-pointer"
                >
                  <span>Partager sur X</span>
                  <span className="text-[10px] bg-[#2D2D2D] text-white px-2 py-0.5 rounded">X</span>
                </button>
                <button
                  type="button"
                  onClick={copyLink}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#FAF8F5] text-[#2D2D2D] hover:bg-[#EAE5D9] border border-[#EAE5D9] font-bold transition flex items-center justify-between text-xs cursor-pointer"
                >
                  <span>Copier le lien public</span>
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

          {/* Right Column: Bio & Reviews */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Bio Card */}
            <div className="bg-white p-6 rounded-2xl border border-[#EAE5D9] shadow-sm space-y-4">
              <h3 className="font-['Manrope'] font-bold text-lg border-b border-[#EAE5D9]/60 pb-2">Description / Biographie</h3>
              {user.bio ? (
                <div className="text-[#2D2D2D] leading-relaxed text-sm whitespace-pre-wrap italic">
                  "{user.bio}"
                </div>
              ) : (
                <p className="text-sm text-[#6C6C6C] italic">Cet utilisateur n'a pas encore rédigé de biographie.</p>
              )}
            </div>

            {/* Reviews Card */}
            <div className="bg-white p-6 rounded-2xl border border-[#EAE5D9] shadow-sm space-y-4">
              <h3 className="font-['Manrope'] font-bold text-lg border-b border-[#EAE5D9]/60 pb-2">
                Avis & Recommandations ({reviews_count})
              </h3>
              
              <div className="space-y-4">
                {reviews.length > 0 ? (
                  reviews.map((rev) => (
                    <div key={rev.id} className="p-4 bg-[#FAF8F5] rounded-xl border border-[#EAE5D9]/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm text-[#2D2D2D]">{rev.from_user_name || "Utilisateur Kaba-Compta"}</div>
                        <div className="text-xs text-[#6C6C6C]">
                          {new Date(rev.created_at).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderStars(rev.stars)}
                        <span className="text-xs font-bold text-[#ECA869]">{rev.stars} / 5</span>
                      </div>
                      {rev.comment && (
                        <p className="text-sm text-[#2D2D2D]/90 leading-relaxed font-medium">
                          {rev.comment}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 space-y-3">
                    <Award className="w-10 h-10 text-[#6C6C6C]/40 mx-auto" />
                    <p className="text-sm text-[#6C6C6C] italic">Aucun avis n'a été publié pour cet utilisateur.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#EAE5D9] py-8 text-center text-sm text-[#6C6C6C] bg-white mt-auto">
        Kaba-Compta Togo — Plateforme communautaire d'entraide et de mise en relation comptable.
      </footer>
    </div>
  );
}
