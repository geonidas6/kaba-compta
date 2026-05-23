import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, MessageSquare, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, fmtFCFA } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const STATUS = {
  ouverte: "Ouverte",
  en_discussion: "En discussion",
  en_travail: "En cours",
  terminee: "Terminée",
  annulee: "Annulée",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [missions, setMissions] = useState([]);
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    api.get("/missions", { params: { scope: "mine" } }).then((r) => setMissions(r.data));
    api.get("/forum/questions", { params: { sort: "recent", limit: 5 } }).then((r) => setQuestions(r.data));
  }, []);

  return (
    <div className="space-y-6" data-testid="merchant-dashboard">
      <div>
        <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Bienvenue</p>
        <h1 className="font-['Manrope'] font-extrabold text-3xl tracking-tight mt-1">
          {user?.display_name}
        </h1>
        <p className="text-[#6C6C6C] mt-1">
          Publiez vos missions et trouvez le bon comptable.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/app/missions" className="card-flat p-5 hover:border-[#C84B31] transition group" data-testid="quick-missions">
          <div className="flex items-center justify-between">
            <Briefcase className="w-6 h-6 text-[#C84B31]" />
            <ArrowRight className="w-4 h-4 text-[#6C6C6C] group-hover:translate-x-1 transition" />
          </div>
          <div className="font-['Manrope'] font-bold mt-3">Mes missions</div>
          <div className="text-xs text-[#6C6C6C]">{missions.length} au total</div>
        </Link>
        <Link to="/app/forum" className="card-flat p-5 hover:border-[#1F4E3D] transition group" data-testid="quick-forum">
          <div className="flex items-center justify-between">
            <MessageSquare className="w-6 h-6 text-[#1F4E3D]" />
            <ArrowRight className="w-4 h-4 text-[#6C6C6C] group-hover:translate-x-1 transition" />
          </div>
          <div className="font-['Manrope'] font-bold mt-3">Forum</div>
          <div className="text-xs text-[#6C6C6C]">Communauté & entraide</div>
        </Link>
      </div>

      <Link to="/app/missions" data-testid="publish-cta">
        <Button className="w-full h-14 bg-[#C84B31] hover:bg-[#A83E28] text-white font-bold rounded-xl text-base">
          <Plus className="w-5 h-5 mr-2" /> Publier une nouvelle mission
        </Button>
      </Link>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-['Manrope'] font-bold text-xl">Mes dernières missions</h2>
          <Link to="/app/missions" className="text-sm text-[#C84B31] font-semibold">Tout voir →</Link>
        </div>
        {missions.length === 0 ? (
          <div className="card-flat p-6 text-center text-sm text-[#6C6C6C]">
            Aucune mission publiée pour l'instant.
          </div>
        ) : (
          <div className="space-y-2">
            {missions.slice(0, 4).map((m) => (
              <Link to={`/app/missions/${m.id}`} key={m.id} className="block card-flat p-3 hover:border-[#C84B31]">
                <div className="flex items-center justify-between">
                  <div className="font-['Manrope'] font-bold truncate">{m.title}</div>
                  <span className="text-xs text-[#6C6C6C]">{STATUS[m.status]}</span>
                </div>
                <div className="text-xs text-[#6C6C6C] flex items-center gap-2 mt-1">
                  <span>{m.offers_count || 0} offre{(m.offers_count || 0) > 1 ? "s" : ""}</span>
                  {m.agreed_price_fcfa && <span>· Prix : {fmtFCFA(m.agreed_price_fcfa)}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-['Manrope'] font-bold text-xl">Forum récent</h2>
          <Link to="/app/forum" className="text-sm text-[#C84B31] font-semibold">Voir tout →</Link>
        </div>
        {questions.length === 0 ? (
          <div className="card-flat p-6 text-center text-sm text-[#6C6C6C]">
            Aucune question encore.
          </div>
        ) : (
          <div className="space-y-2">
            {questions.slice(0, 4).map((q) => (
              <Link to={`/app/forum/${q.id}`} key={q.id} className="block card-flat p-3 hover:border-[#1F4E3D]">
                <div className="font-['Manrope'] font-bold text-sm truncate">{q.title}</div>
                <div className="text-xs text-[#6C6C6C] mt-1">
                  {q.answers_count} réponse{q.answers_count > 1 ? "s" : ""} · {q.votes} vote{q.votes > 1 ? "s" : ""}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
