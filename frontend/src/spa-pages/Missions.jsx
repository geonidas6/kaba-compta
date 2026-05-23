import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Plus, MapPin, Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { api, fmtFCFA } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const MISSION_TYPES = [
  { v: "caisse", l: "Point de caisse" },
  { v: "inventaire", l: "Inventaire stock" },
  { v: "audit", l: "Audit / Rapport" },
  { v: "fiscal", l: "Fiscal / TVA" },
  { v: "paie", l: "Paie" },
  { v: "creation_entreprise", l: "Création d'entreprise" },
  { v: "autre", l: "Autre" },
];

const STATUS_LABELS = {
  ouverte: { l: "Ouverte aux offres", c: "bg-[#1F4E3D] text-white" },
  en_discussion: { l: "En discussion", c: "bg-[#ECA869] text-[#2D2D2D]" },
  en_travail: { l: "En cours", c: "bg-[#C84B31] text-white" },
  terminee: { l: "Terminée", c: "bg-[#6C6C6C] text-white" },
  annulee: { l: "Annulée", c: "bg-[#D32F2F] text-white" },
};

export default function Missions() {
  const { user } = useAuth();
  const isMerchant = user?.role === "merchant";
  const [tab, setTab] = useState(isMerchant ? "mine" : "feed");
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const load = async (scope) => {
    const params = { scope };
    if (q) params.q = q;
    if (typeFilter !== "all") params.type_f = typeFilter;
    const r = await api.get("/missions", { params });
    setItems(r.data);
  };

  useEffect(() => {
    load(tab);
    // eslint-disable-next-line
  }, [tab, typeFilter]);

  return (
    <div className="space-y-4" data-testid="missions-page">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">
            {isMerchant ? "Mes missions" : "Offres de missions"}
          </p>
          <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1">Missions</h1>
          <p className="text-sm text-[#6C6C6C] mt-1">
            {isMerchant
              ? "Publiez un besoin, recevez les offres des comptables, choisissez."
              : "Proposez vos services aux marchands. Négociez prix et délais."}
          </p>
        </div>
        {isMerchant && (
          <Link
            to="/app/missions/create"
            data-testid="publish-mission-btn"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-full transition shadow"
          >
            <Plus className="w-4 h-4 mr-1" /> Publier
          </Link>
        )}
      </div>

      <div className="card-flat p-3 flex gap-2 flex-wrap items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-[#6C6C6C] absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(tab)}
            placeholder="Rechercher..."
            className="h-10 pl-9"
            data-testid="missions-search-input"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-10 w-44" data-testid="missions-type-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {MISSION_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 w-full">
          {isMerchant ? (
            <>
              <TabsTrigger value="mine" data-testid="tab-mine">Mes missions</TabsTrigger>
              <TabsTrigger value="feed" data-testid="tab-feed">Toutes ouvertes</TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="feed" data-testid="tab-feed">Disponibles</TabsTrigger>
              <TabsTrigger value="mine" data-testid="tab-mine">Mes offres</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {items.length === 0 && (
            <div className="card-flat p-8 text-center">
              <Briefcase className="w-10 h-10 text-[#6C6C6C] mx-auto" />
              <div className="mt-3 text-[#6C6C6C]">Aucune mission.</div>
            </div>
          )}
          {items.map((m) => <MissionCard key={m.id} m={m} isMerchant={isMerchant} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MissionCard({ m, isMerchant }) {
  const st = STATUS_LABELS[m.status] || { l: m.status, c: "bg-gray-200" };
  const budget = m.budget_min_fcfa && m.budget_max_fcfa
    ? `${fmtFCFA(m.budget_min_fcfa)} – ${fmtFCFA(m.budget_max_fcfa)}`
    : m.budget_min_fcfa
      ? `À partir de ${fmtFCFA(m.budget_min_fcfa)}`
      : m.budget_max_fcfa
        ? `Jusqu'à ${fmtFCFA(m.budget_max_fcfa)}`
        : "Budget à discuter";
  return (
    <Link to={`/app/missions/${m.id}`} className="block card-flat p-4 hover:border-[#C84B31] transition" data-testid={`mission-card-${m.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-['Manrope'] font-bold">{m.title}</div>
          <div className="text-xs text-[#6C6C6C] mt-1 flex items-center gap-2 flex-wrap">
            <span className="capitalize">{m.type?.replace(/_/g, " ")}</span>
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {m.location}</span>
            <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {m.duration_hours}h</span>
            {m.remote_ok && <span className="text-[#1F4E3D] font-semibold">· Télétravail OK</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-['Manrope'] font-bold text-[#C84B31] text-sm">{budget}</div>
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${st.c}`}>{st.l}</span>
        </div>
      </div>
      <div className="text-sm text-[#2D2D2D]/80 mt-2 line-clamp-2">{m.description}</div>
      <div className="flex items-center justify-between mt-2 text-xs text-[#6C6C6C]">
        <span>Par <strong>{m.merchant_shop || m.merchant_name}</strong></span>
        {isMerchant && m.offers_count > 0 && (
          <span className="text-[#1F4E3D] font-semibold">
            {m.offers_count} offre{m.offers_count > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </Link>
  );
}
