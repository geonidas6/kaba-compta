import React, { useEffect, useState } from "react";
import { ListChecks, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/audit-logs", { params: { limit: 300 } });
      setLogs(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4" data-testid="admin-audit-page">
      <div className="flex items-start justify-between">
        <div>
          <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Console admin</p>
          <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1 flex items-center gap-2">
            <ListChecks className="w-7 h-7 text-[#C84B31]" /> Journal d'audit
          </h1>
          <p className="text-sm text-[#6C6C6C] mt-2">
            Toutes les actions effectuées par un admin en mode "Connexion en tant que".
          </p>
        </div>
        <Button onClick={load} disabled={loading} data-testid="reload-audit-btn" variant="outline" className="rounded-full">
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Rafraîchir
        </Button>
      </div>

      {logs.length === 0 ? (
        <div className="card-flat p-10 text-center">
          <ListChecks className="w-12 h-12 mx-auto text-[#6C6C6C]" />
          <div className="font-['Manrope'] font-bold mt-3">Aucune action journalisée</div>
          <div className="text-sm text-[#6C6C6C] mt-1">Les actions apparaîtront dès qu'un admin utilisera le mode "Connexion en tant que".</div>
        </div>
      ) : (
        <div className="card-flat divide-y divide-[#EAE5D9]">
          {logs.map((lg) => (
            <div key={lg.id} className="p-3" data-testid={`audit-log-${lg.id}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-semibold text-[#1F4E3D]">{lg.admin_name || lg.admin_id?.slice(0, 8)}</span>
                  <span className="text-[#6C6C6C]">→</span>
                  <span className="font-semibold">
                    {lg.actor_name || lg.actor_user_id?.slice(0, 8)}
                    {lg.actor_role && <span className="text-xs text-[#6C6C6C] ml-1">({lg.actor_role})</span>}
                  </span>
                </div>
                <span className="text-xs text-[#6C6C6C]">{new Date(lg.created_at).toLocaleString("fr-FR")}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <code className="text-xs bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#EAE5D9]">
                  <span className={`font-bold mr-1 ${
                    lg.method === "DELETE" ? "text-[#D32F2F]" :
                    lg.method === "PUT" || lg.method === "PATCH" ? "text-[#ECA869]" :
                    "text-[#1F4E3D]"
                  }`}>{lg.method}</span>
                  {lg.path}
                </code>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  lg.status_code < 300 ? "bg-[#1F4E3D]/10 text-[#1F4E3D]" : "bg-[#C84B31]/10 text-[#C84B31]"
                }`}>{lg.status_code}</span>
              </div>
              {lg.body_preview && (
                <pre className="mt-2 text-xs bg-[#FAF8F5] p-2 rounded border border-[#EAE5D9] overflow-x-auto max-h-32">
                  {lg.body_preview}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
