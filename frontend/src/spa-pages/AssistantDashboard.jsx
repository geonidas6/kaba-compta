import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Star, Crown, GraduationCap, ArrowRight, ShieldCheck, MessageSquare } from "lucide-react";
import { api, fmtFCFA } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const formatCompactBudget = (n) => Number(n || 0).toLocaleString("fr-FR").replaceAll(" ", ".").replaceAll(" ", ".");

const STATUS_COLORS = {
  ouverte: { style: { background: "#EAF5EE", borderColor: "#1F4E3D", borderWidth: 2 } },
  en_discussion: { style: { background: "#EAF5EE", borderColor: "#1F4E3D", borderWidth: 2 } },
  en_travail: { style: { background: "#EAF5EE", borderColor: "#1F4E3D", borderWidth: 2 } },
  terminee: { style: { background: "#FFF4E3", borderColor: "#ECA869", borderWidth: 2 } },
  annulee: { style: { background: "#FFF1F1", borderColor: "#D32F2F", borderWidth: 2 } },
};

export default function AssistantDashboard() {
  const { user, refresh } = useAuth();
  const [missions, setMissions] = useState([]);
  const [myOffers, setMyOffers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [cfg, setCfg] = useState({ premium_enabled: false, premium_price_fcfa: 2000, premium_duration_days: 30 });

  useEffect(() => {
    api.get("/missions", { params: { scope: "feed" } }).then((r) => setMissions(r.data));
    api.get("/offers/my").then((r) => setMyOffers(r.data));
    api.get("/forum/questions", { params: { sort: "recent" } }).then((r) => setQuestions(r.data));
    api.get("/public/config").then((r) => setCfg(r.data));
  }, []);

  const subscribePremium = async () => {
    try {
      await api.post("/premium/subscribe");
      toast.success("Vous êtes maintenant Premium !");
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  const activeOffers = myOffers.filter((o) => o.status === "active");
  const wonOffers = myOffers.filter((o) => o.status === "selected");

  return (
    <div className="space-y-6" data-testid="assistant-dashboard">
      <div>
        <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Comptable</p>
        <h1 className="font-['Manrope'] font-extrabold text-3xl tracking-tight mt-1">
          {user?.display_name}
        </h1>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#1F4E3D] text-white px-2.5 py-1 rounded-full">
            <GraduationCap className="w-3.5 h-3.5" /> Niveau {user?.education_level || "Licence"}
          </span>
          {user?.is_premium && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#ECA869] text-[#2D2D2D] px-2.5 py-1 rounded-full">
              <Crown className="w-3.5 h-3.5" /> Premium
            </span>
          )}
          {user?.kyc_status === "pending" && (
            <span className="text-xs text-[#6C6C6C]">KYC en cours</span>
          )}
          {user?.kyc_status === "approved" && (
            <span className="text-xs text-[#1F4E3D] inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Vérifié
            </span>
          )}
        </div>
      </div>


      <div className="card-flat p-3">
        <div className="text-xs font-bold uppercase tracking-widest text-[#1F4E3D] mb-2">Code couleur des missions</div>
        <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 text-[#1F4E3D]"><span className="w-2.5 h-2.5 rounded-full bg-[#1F4E3D]"></span>Ouverte</span>
          <span className="inline-flex items-center gap-1.5 text-[#D32F2F]"><span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F]"></span>Fermée</span>
          <span className="inline-flex items-center gap-1.5 text-[#A8661F]"><span className="w-2.5 h-2.5 rounded-full bg-[#ECA869]"></span>Terminée</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon={Briefcase} label="Offres en attente" value={activeOffers.length} color="#C84B31" testid="stat-active-offers" />
        <Stat icon={Briefcase} label="Missions gagnées" value={wonOffers.length} color="#1F4E3D" testid="stat-won" />
        <Stat icon={Star} label="Note moyenne" value={`${user?.rating_avg || 0} / 5`} color="#ECA869" testid="rating-avg" />
        <Stat icon={MessageSquare} label="Questions forum" value={questions.length} color="#1F4E3D" testid="stat-forum" />
      </div>

      {!user?.is_premium && cfg.premium_enabled && (
        <div className="card-flat p-5 bg-gradient-to-br from-[#1F4E3D] to-[#163328] text-white border-0" data-testid="premium-card">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-[#ECA869]" />
            <span className="uppercase text-xs tracking-widest font-bold">Premium</span>
          </div>
          <div className="font-['Manrope'] font-bold text-xl">
            Apparaissez en tête de liste pour {fmtFCFA(cfg.premium_price_fcfa)} / {cfg.premium_duration_days} jours
          </div>
          <p className="text-sm text-white/85 mt-2">
            Doublez vos chances d'obtenir des missions. Badge Premium visible.
          </p>
          <Button
            onClick={subscribePremium}
            data-testid="premium-subscribe-btn"
            className="mt-4 bg-[#ECA869] hover:bg-[#d99151] text-[#1F4E3D] font-bold rounded-full"
          >
            Devenir Premium <ArrowRight className="ml-1 w-4 h-4" />
          </Button>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-['Manrope'] font-bold text-xl">Forum récent</h2>
          <Link to="/app/forum" className="text-sm text-[#C84B31] font-semibold">Voir tout →</Link>
        </div>
        <div className="space-y-2">
          {questions.slice(0, 4).map((q) => (
            <Link to={`/app/forum/${q.slug || q.id}`} key={q.id} className="block card-flat p-3 hover:border-[#1F4E3D]">
              <div className="font-['Manrope'] font-bold text-sm truncate">{q.title}</div>
              <div className="text-xs text-[#6C6C6C] mt-1">
                {q.answers_count} réponse{q.answers_count > 1 ? "s" : ""} · {q.votes} vote{q.votes > 1 ? "s" : ""}
              </div>
            </Link>
          ))}
          {questions.length === 0 && (
            <div className="text-[#6C6C6C] text-sm">Aucune question récente pour le moment.</div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-['Manrope'] font-bold text-xl">Missions disponibles</h2>
          <Link to="/app/missions" className="text-sm text-[#C84B31] font-semibold">Tout voir →</Link>
        </div>
        <div className="space-y-3">
          {missions.slice(0, 5).map((m) => (
            <MissionCard key={m.id} m={m} />
          ))}
          {missions.length === 0 && (
            <div className="text-[#6C6C6C] text-sm">Aucune mission disponible pour le moment.</div>
          )}
        </div>
      </div>

      {myOffers.length > 0 && (
        <div>
          <h2 className="font-['Manrope'] font-bold text-xl mb-3">Mes offres en cours</h2>
          <div className="space-y-2">
            {myOffers.slice(0, 5).map((o) => (
              <Link to={`/app/missions/${o.mission?.slug || o.mission_id}`} key={o.id} className="block card-flat p-3 hover:border-[#C84B31]">
                <div className="flex items-center justify-between">
                  <div className="font-['Manrope'] font-bold truncate">{o.mission?.title || "Mission"}</div>
                  <div className="text-sm text-[#C84B31] font-bold">{fmtFCFA(o.price_fcfa)}</div>
                </div>
                <div className="text-xs text-[#6C6C6C] mt-1">
                  Statut : {o.status === "active" ? "En attente" : o.status === "selected" ? "Acceptée 🎉" : "Non retenue"}
                  · {o.delivery_days}j
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link to="/app/forum">
        <Button variant="outline" className="w-full h-12" data-testid="goto-forum">
          <MessageSquare className="w-4 h-4 mr-2" /> Explorer le forum
        </Button>
      </Link>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color, testid }) {
  return (
    <div className="card-flat p-4" data-testid={testid}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-[#6C6C6C]">
        <Icon className="w-4 h-4" style={{ color }} /> {label}
      </div>
      <div className="font-['Manrope'] font-extrabold text-2xl mt-2" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function MissionCard({ m }) {
  const tone = STATUS_COLORS[m.status] || STATUS_COLORS.ouverte;
  const budget = (m.budget_min_fcfa != null && m.budget_max_fcfa != null)
    ? (m.budget_min_fcfa === m.budget_max_fcfa
      ? fmtFCFA(m.budget_min_fcfa)
      : fmtFCFA(m.budget_min_fcfa) + " – " + fmtFCFA(m.budget_max_fcfa))
    : m.budget_min_fcfa != null
      ? "À partir de " + fmtFCFA(m.budget_min_fcfa)
      : m.budget_max_fcfa != null
        ? "<" + formatCompactBudget(m.budget_max_fcfa) + " FCFA"
        : "Budget à discuter";
  return (
    <Link to={`/app/missions/${m.slug || m.id}`} className="block card-flat p-4 transition hover:border-[#C84B31]" style={tone.style} data-testid={`mission-card-${m.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-['Manrope'] font-bold truncate">{m.title}</div>
          <div className="text-xs text-[#6C6C6C] mt-1">
            {m.merchant_shop || m.merchant_name} · {m.merchant_city}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-['Manrope'] font-bold text-[#C84B31] text-sm">{budget}</div>
        </div>
      </div>
      <p className="mt-3 text-sm text-[#2D2D2D]/85 line-clamp-2">{m.description}</p>
      {m.offers_count > 0 && (
        <div className="text-xs text-[#6C6C6C] mt-2">{m.offers_count} offre{m.offers_count > 1 ? "s" : ""} déjà reçue{m.offers_count > 1 ? "s" : ""}</div>
      )}
    </Link>
  );
}
