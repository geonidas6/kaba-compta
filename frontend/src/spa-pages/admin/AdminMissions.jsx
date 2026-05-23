import React, { useEffect, useState } from "react";
import { Briefcase, MapPin, Clock } from "lucide-react";
import { api, fmtFCFA } from "@/lib/api";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  { v: "", l: "Tous statuts" },
  { v: "open", l: "Ouvertes" },
  { v: "assigned", l: "Attribuées" },
  { v: "in_progress", l: "En cours" },
  { v: "completed", l: "Terminées" },
  { v: "cancelled", l: "Annulées" },
];

export default function AdminMissions() {
  const [items, setItems] = useState([]);
  const [statusF, setStatusF] = useState("");

  const load = async () => {
    const params = {};
    if (statusF) params.status_f = statusF;
    const r = await api.get("/admin/missions", { params });
    setItems(r.data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusF]);

  return (
    <div className="space-y-4" data-testid="admin-missions-page">
      <div>
        <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Console admin</p>
        <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1 flex items-center gap-2">
          <Briefcase className="w-7 h-7 text-[#C84B31]" /> Missions
        </h1>
      </div>

      <div>
        <Select value={statusF || "all"} onValueChange={(v) => setStatusF(v === "all" ? "" : v)}>
          <SelectTrigger className="w-56" data-testid="admin-mission-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {STATUS_OPTIONS.filter((s) => s.v).map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="card-flat divide-y divide-[#EAE5D9]">
        {items.length === 0 && <div className="p-6 text-center text-[#6C6C6C]">Aucune mission.</div>}
        {items.map((m) => (
          <div key={m.id} className="p-4" data-testid={`admin-mission-${m.id}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="font-['Manrope'] font-bold">{m.title}</div>
                <div className="text-xs text-[#6C6C6C] mt-0.5">
                  Par {m.merchant_shop || m.merchant_name}
                  {m.assistant_name && ` → ${m.assistant_name}`}
                </div>
                <div className="text-xs text-[#6C6C6C] mt-1 flex items-center gap-2 flex-wrap">
                  <span className="capitalize">{m.type}</span>
                  <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {m.location}</span>
                  <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {m.duration_hours}h</span>
                  <span className="font-semibold text-[#1F4E3D]">{m.status}</span>
                  {m.paid && <span className="text-[#1F4E3D]">· Payée</span>}
                </div>
              </div>
              <div className="font-['Manrope'] font-bold text-[#C84B31]">{fmtFCFA(m.budget_fcfa)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
