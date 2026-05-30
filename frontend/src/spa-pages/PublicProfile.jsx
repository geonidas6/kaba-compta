import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { User, Star, ShieldCheck, MapPin, Calendar, Share2, Copy, Sparkles, Briefcase, Award, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const monthYear = (value) => {
  if (!value) return "";
  const [year, month] = String(value).split("-");
  if (!year || !month) return value;
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};
const period = (item) => `${monthYear(item.start_date) || "Début"} - ${item.current ? "En cours" : monthYear(item.end_date) || "Fin"}`;
const langName = (lang) => typeof lang === "string" ? lang : lang.name;
const langLevel = (lang) => typeof lang === "string" ? "" : lang.level;
const hasContent = (item, keys) => keys.some((key) => String(item?.[key] || "").trim());

function Card({ title, icon: Icon, children, className = "" }) {
  return (
    <section className={`bg-white p-6 rounded-2xl border border-[#EAE5D9] shadow-sm space-y-4 ${className}`}>
      <h3 className="font-['Manrope'] font-bold text-xl border-b border-[#EAE5D9]/60 pb-2 flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5 text-[#1F4E3D]" />} {title}
      </h3>
      {children}
    </section>
  );
}

export default function PublicProfile() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/users/${userId}/public-profile`)
      .then((r) => { setData(r.data); setError(null); })
      .catch((err) => setError(err?.response?.data?.detail || "Profil introuvable"))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#FAF8F5]"><div className="w-10 h-10 border-4 border-[#C84B31] border-t-transparent rounded-full animate-spin" /></div>;
  if (error || !data) return <div className="min-h-screen grid place-items-center bg-[#FAF8F5] p-4"><div className="card-flat p-6 max-w-sm text-center"><h2 className="font-bold text-lg">Profil introuvable</h2><p className="text-sm text-[#6C6C6C] mt-2">{error}</p></div></div>;

  const { user, reviews, avg_rating, reviews_count, missions_count } = data;
  const isAssistant = user.role === "assistant";
  const experiences = (user.experiences || []).filter((x) => hasContent(x, ["title", "company", "description"]));
  const formations = (user.formations || []).filter((x) => hasContent(x, ["degree", "school", "description"]));
  const references = (user.references || []).filter((x) => hasContent(x, ["name", "role", "contact", "relation"]));
  const languages = (user.languages || []).filter((x) => langName(x));
  const shareUrl = window.location.href;
  const shareText = `Découvrez le profil de ${user.display_name} sur Kaba-Compta Togo !`;

  const openShare = (url) => window.open(url, "_blank");
  const copyLink = () => { navigator.clipboard.writeText(shareUrl); toast.success("Lien copié"); };
  const renderStars = (rating) => {
    const rounded = Math.round(rating);
    return <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`w-4 h-4 ${s <= rounded ? "fill-[#ECA869] text-[#ECA869]" : "text-[#EAE5D9] fill-transparent"}`} />)}</div>;
  };

  const statsCard = (className = "") => (
    <Card title="Statistiques" className={className}>
      <div className="grid grid-cols-3 lg:grid-cols-1 gap-4">
        <div className="p-3 bg-[#FAF8F5] rounded-xl text-center lg:text-left"><div className="text-2xl font-extrabold text-[#C84B31]">{missions_count}</div><div className="text-xs text-[#6C6C6C] font-semibold mt-0.5">{isAssistant ? "Projets réalisés" : "Missions publiées"}</div></div>
        <div className="p-3 bg-[#FAF8F5] rounded-xl text-center lg:text-left"><div className="text-2xl font-extrabold text-[#1F4E3D]">{avg_rating} <span className="text-xs text-[#6C6C6C] font-normal">/ 5</span></div><div className="flex justify-center lg:justify-start mt-1">{renderStars(avg_rating)}</div></div>
        <div className="p-3 bg-[#FAF8F5] rounded-xl text-center lg:text-left"><div className="text-2xl font-extrabold text-[#ECA869]">{reviews_count}</div><div className="text-xs text-[#6C6C6C] font-semibold mt-0.5">Avis reçus</div></div>
      </div>
      {currentUser && <Link to={isAssistant ? "/app/missions/create" : "/app/missions"} className="block"><Button className="w-full h-11 bg-[#1F4E3D] hover:bg-[#16372B] text-white rounded-xl text-sm font-bold">{isAssistant ? "Recruter ce comptable" : "Consulter les missions"}</Button></Link>}
    </Card>
  );

  const shareCard = (className = "") => (
    <Card title="Partager le profil" icon={Share2} className={className}>
      <div className="flex flex-wrap gap-3">
        <button type="button" aria-label="WhatsApp" onClick={() => openShare(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`)} className="w-11 h-11 rounded-full bg-[#25D366] text-white font-extrabold">W</button>
        <button type="button" aria-label="Facebook" onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`)} className="w-11 h-11 rounded-full bg-[#1877F2] text-white font-extrabold">f</button>
        <button type="button" aria-label="LinkedIn" onClick={() => openShare(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`)} className="w-11 h-11 rounded-full bg-[#0A66C2] text-white font-extrabold">in</button>
        <button type="button" aria-label="X" onClick={() => openShare(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`)} className="w-11 h-11 rounded-full bg-[#2D2D2D] text-white font-extrabold">X</button>
        <button type="button" aria-label="Copier le lien" onClick={copyLink} className="w-11 h-11 rounded-full bg-white border border-[#EAE5D9] text-[#2D2D2D] grid place-items-center"><Copy className="w-4 h-4" /></button>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D2D2D] flex flex-col">
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur border-b border-[#EAE5D9]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#C84B31] text-white grid place-items-center font-bold shrink-0">K</div>
            <span className="font-['Manrope'] font-extrabold text-lg leading-tight">Kaba-Compta</span>
          </Link>
          {currentUser && (
            <Link to="/app/profile">
              <Button variant="outline" className="border-[#1F4E3D] text-[#1F4E3D] hover:bg-[#1F4E3D] hover:text-white rounded-full px-4 text-xs font-semibold">Quitter</Button>
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-[#EAE5D9] shadow-sm overflow-hidden">
          <div className="h-32 sm:h-40 relative overflow-hidden bg-[#1F4E3D]">
            <picture>
              <source media="(max-width: 639px)" srcSet="/kaba-compta-cover-mobile.svg?v=2" />
              <img src="/kaba-compta-cover.svg?v=3" alt="Kaba-Compta" className="absolute inset-0 h-full w-full object-cover" />
            </picture>
            {user.is_premium && <div className="absolute right-4 top-4 bg-[#ECA869] text-[#1F4E3D] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow"><Sparkles className="w-3 h-3 fill-current" /> Premium</div>}
          </div>
          <div className="px-6 pb-6 pt-0 relative flex flex-col sm:flex-row sm:items-end gap-5">
            <div className="-mt-16 relative z-10 shrink-0">
              {user.avatar_url ? <img src={user.avatar_url} alt={user.display_name} className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border-4 border-white shadow" /> : <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-[#1F4E3D] text-white font-['Manrope'] font-bold text-4xl grid place-items-center border-4 border-white shadow">{user.display_name?.[0]?.toUpperCase()}</div>}
            </div>
            <div className="flex-1 min-w-0 pt-2 sm:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-['Manrope'] font-extrabold text-2xl sm:text-3xl leading-tight">{user.display_name}</h1>
                {user.kyc_status === "approved" && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Vérifié</span>}
              </div>
              <div className="mt-1 text-sm text-[#6C6C6C] font-medium flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${isAssistant ? "bg-[#1F4E3D]/10 text-[#1F4E3D]" : "bg-[#C84B31]/10 text-[#C84B31]"}`}>{isAssistant ? `Comptable · Niveau ${user.education_level || "Licence"}` : "Commerçant"}</span>
                {user.city && <span className="flex items-center gap-0.5"><MapPin className="w-3.5 h-3.5" /> {user.city}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <div className="space-y-6">
            <Card title="Description">
              {user.bio ? <div className="text-[#2D2D2D] leading-relaxed text-base whitespace-pre-wrap">{user.bio}</div> : <p className="text-base text-[#6C6C6C] italic">Cet utilisateur n'a pas encore rédigé de description.</p>}
            </Card>

            <div className="lg:hidden">{statsCard()}</div>

            {isAssistant && experiences.length > 0 && <Card title="Expériences" icon={Briefcase}><div className="space-y-4">{experiences.map((exp, i) => <div key={i} className="border-l-2 border-[#1F4E3D] pl-3"><div className="font-bold text-lg">{exp.title || "Expérience"}{exp.company ? ` - ${exp.company}` : ""}</div><div className="text-base text-[#6C6C6C] font-semibold">{period(exp)}</div>{exp.description && <p className="text-base mt-2 whitespace-pre-wrap leading-relaxed">{exp.description}</p>}</div>)}</div></Card>}

            {isAssistant && <Card title="Formations" icon={Calendar}>{formations.length > 0 ? <div className="space-y-4">{formations.map((edu, i) => <div key={i} className="border-l-2 border-[#ECA869] pl-3"><div className="font-bold text-base">{edu.degree || "Formation"}{edu.school ? ` - ${edu.school}` : ""}</div><div className="text-sm text-[#6C6C6C]">{period(edu)}</div>{edu.description && <p className="text-sm mt-1 whitespace-pre-wrap">{edu.description}</p>}</div>)}</div> : <p className="text-sm text-[#6C6C6C] italic">Aucune formation renseignée.</p>}</Card>}

            {isAssistant && (user.skills || []).length > 0 && <Card title="Compétences" icon={Award}><div className="flex flex-wrap gap-2">{user.skills.map((skill) => <span key={skill} className="px-2.5 py-1 rounded-full bg-[#1F4E3D] text-white text-sm font-semibold">{skill}</span>)}</div></Card>}

            {isAssistant && languages.length > 0 && <Card title="Langues" icon={Languages}><div className="grid sm:grid-cols-2 gap-2">{languages.map((lang, i) => <div key={`${langName(lang)}-${i}`} className="px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#EAE5D9]"><div className="font-bold text-sm">{langName(lang)}</div>{langLevel(lang) && <div className="text-xs text-[#6C6C6C]">{langLevel(lang)}</div>}</div>)}</div></Card>}

            {isAssistant && references.length > 0 && <Card title="Références" icon={User}><div className="grid sm:grid-cols-2 gap-3">{references.map((ref, i) => <div key={i} className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE5D9]"><div className="font-bold text-base">{ref.name || "Référence"}{ref.relation ? ` - ${ref.relation}` : ""}</div>{ref.role && <div className="text-sm text-[#6C6C6C] mt-0.5">{ref.role}</div>}{ref.contact && <div className="text-sm font-semibold mt-1 text-[#1F4E3D]">{ref.contact}</div>}</div>)}</div></Card>}

            <Card title={`Avis (${reviews_count})`} icon={Award}>
              {reviews.length > 0 ? <div className="space-y-4">{reviews.map((rev) => <div key={rev.id} className="p-4 bg-[#FAF8F5] rounded-xl border border-[#EAE5D9]/50 space-y-2"><div className="flex items-center justify-between"><div className="font-bold text-sm">{rev.from_user_name || "Utilisateur Kaba-Compta"}</div><div className="text-xs text-[#6C6C6C]">{new Date(rev.created_at).toLocaleDateString("fr-FR")}</div></div><div className="flex items-center gap-2">{renderStars(rev.stars)}<span className="text-xs font-bold text-[#ECA869]">{rev.stars} / 5</span></div>{rev.comment && <p className="text-sm">{rev.comment}</p>}</div>)}</div> : <p className="text-sm text-[#6C6C6C] italic">Aucun avis n'a été publié pour cet utilisateur.</p>}
            </Card>

            <div className="lg:hidden">{shareCard()}</div>
          </div>

          <aside className="hidden lg:block space-y-6 lg:sticky lg:top-24">
            {statsCard("p-5")}
            {shareCard("p-5")}
          </aside>
        </div>
      </main>

      <footer className="border-t border-[#EAE5D9] py-8 text-center text-sm text-[#6C6C6C] bg-white mt-auto">Kaba-Compta Togo — Plateforme communautaire d'entraide et de mise en relation comptable.</footer>
    </div>
  );
}
