import React, { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Database, ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function AdminCronJobs() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/admin/settings").then((r) => setData(r.data));
  }, []);

  const jobs = data?.platform?.cronicle_jobs || [];
  const cronicleUrl = data?.platform?.cronicle_url || "";
  const apiKeyReady = Boolean(data?.platform?.cronicle_api_key_set);

  return (
    <div className="space-y-6" data-testid="admin-cron-jobs-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Console admin</p>
          <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1 flex items-center gap-2">
            <CalendarClock className="w-7 h-7 text-[#1F4E3D]" /> Tâches cron
          </h1>
          <p className="text-sm text-[#6C6C6C] mt-2 max-w-2xl">
            Cette page liste les traitements automatiques du backend. Les tâches sont déployées dans Cronicle et exécutées selon leur fréquence.
          </p>
        </div>
        <Link to="/admin/settings">
          <Button variant="outline" className="rounded-full border-[#1F4E3D] text-[#1F4E3D]">
            <RefreshCw className="w-4 h-4 mr-1" /> Voir les paramètres
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="card-flat p-4 bg-white">
          <div className="flex items-center gap-2 text-[#1F4E3D] font-bold">
            <CheckCircle2 className="w-4 h-4" /> {jobs.length} tâches
          </div>
          <p className="text-sm text-[#6C6C6C] mt-2">Jobs actuellement déclarés dans la configuration Cronicle de l'application.</p>
        </div>
        <div className="card-flat p-4 bg-white">
          <div className="flex items-center gap-2 text-[#1F4E3D] font-bold">
            <Database className="w-4 h-4" /> Cronicle
          </div>
          <p className="text-sm text-[#6C6C6C] mt-2">{cronicleUrl || "Aucune URL configurée"}</p>
        </div>
        <div className="card-flat p-4 bg-white">
          <div className="flex items-center gap-2 text-[#1F4E3D] font-bold">
            <ShieldAlert className="w-4 h-4" /> API Cronicle
          </div>
          <p className="text-sm text-[#6C6C6C] mt-2">{apiKeyReady ? "Clé API configurée" : "Clé API manquante"}</p>
        </div>
      </div>

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.key} className="card-flat p-5 bg-white" data-testid={`cron-job-${job.key}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-['Manrope'] font-bold text-xl">{job.title}</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1F4E3D]/10 text-[#1F4E3D]">{job.key}</span>
                </div>
                <p className="text-sm text-[#6C6C6C] mt-2 max-w-3xl">{job.description}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-[#6C6C6C] uppercase tracking-wider">Fréquence</div>
                <div className="text-sm font-semibold text-[#2D2D2D] mt-1">{job.schedule}</div>
              </div>
            </div>

            <div className="grid md:grid-cols-[1fr_auto] gap-3 mt-4 items-center">
              <div className="rounded-xl bg-[#FAF8F5] border border-[#EAE5D9] p-3 text-sm text-[#2D2D2D] overflow-x-auto">
                <span className="font-semibold text-[#1F4E3D]">Commande:</span> <span className="font-mono">{job.command}</span>
              </div>
              <div className="text-xs text-[#6C6C6C] md:text-right">
                <div>Timing: {JSON.stringify(job.timing)}</div>
              </div>
            </div>
          </div>
        ))}

        {!jobs.length && data && (
          <div className="card-flat p-6 text-center text-[#6C6C6C]">
            Aucune tâche cron n'est déclarée.
          </div>
        )}
      </div>

      <div className="card-flat p-5 bg-[#1F4E3D]/5 border-[#1F4E3D]/20">
        <div className="flex items-center gap-2 text-[#1F4E3D] font-bold">
          <ExternalLink className="w-4 h-4" /> Ce que fait cette page
        </div>
        <p className="text-sm text-[#2D2D2D] mt-2 leading-relaxed">
          Elle centralise les tâches automatiques qui gardent la plateforme vivante: expiration KYC, rappels de missions, notifications forum, digests quotidiens, et maintenant les rappels d'avis.
          Si vous modifiez la liste des jobs, pensez à relancer le redeploy Cronicle depuis les paramètres.
        </p>
      </div>
    </div>
  );
}
