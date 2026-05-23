import React, { useEffect, useState } from "react";
import { Users, Briefcase, ShieldCheck, Crown, CheckCircle2, MessageSquare, Flag, Send } from "lucide-react";
import { api } from "@/lib/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/admin/stats").then((r) => setStats(r.data));
  }, []);

  if (!stats) return <div className="text-[#6C6C6C]">Chargement...</div>;

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div>
        <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Console admin</p>
        <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1">Tableau de bord</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={Users} label="Utilisateurs" value={stats.users_count} color="#1F4E3D" testid="kpi-users" />
        <KPI icon={Users} label="Marchands" value={stats.merchants} color="#C84B31" testid="kpi-merchants" />
        <KPI icon={Users} label="Comptables" value={stats.assistants} color="#1F4E3D" testid="kpi-assistants" />
        <KPI icon={Crown} label="Premium" value={stats.premium_assistants} color="#ECA869" testid="kpi-premium" />
        <KPI icon={Briefcase} label="Missions totales" value={stats.missions_total} color="#1F4E3D" testid="kpi-missions-total" />
        <KPI icon={Briefcase} label="Missions ouvertes" value={stats.missions_open} color="#C84B31" testid="kpi-missions-open" />
        <KPI icon={Send} label="En cours" value={stats.missions_in_progress} color="#ECA869" testid="kpi-missions-progress" />
        <KPI icon={CheckCircle2} label="Terminées" value={stats.missions_completed} color="#1F4E3D" testid="kpi-missions-done" />
        <KPI icon={Briefcase} label="Offres envoyées" value={stats.offers_total} color="#1F4E3D" testid="kpi-offers" />
        <KPI icon={MessageSquare} label="Forum — questions" value={stats.forum_questions} color="#C84B31" testid="kpi-forum-q" />
        <KPI icon={MessageSquare} label="Forum — réponses" value={stats.forum_answers} color="#1F4E3D" testid="kpi-forum-a" />
        <KPI icon={Flag} label="Signalements ouverts" value={stats.open_reports} color="#C84B31" testid="kpi-reports" />
        <KPI icon={ShieldCheck} label="KYC en attente" value={stats.kyc_pending_count} color="#ECA869" testid="kpi-kyc" />
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, color, testid }) {
  return (
    <div className="card-flat p-4" data-testid={testid}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#6C6C6C] font-bold">
        <Icon className="w-4 h-4" style={{ color }} /> {label}
      </div>
      <div className="font-['Manrope'] font-extrabold text-2xl mt-2" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
