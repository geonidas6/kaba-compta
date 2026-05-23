import React, { useEffect, useState } from "react";
import { ShieldCheck, FileText, Check, X, Eye } from "lucide-react";
import { api, API } from "@/lib/api";
import { toast } from "sonner";

export default function AdminKyc() {
  const [items, setItems] = useState([]);

  const load = async () => {
    const r = await api.get("/admin/kyc/pending");
    setItems(r.data);
  };

  useEffect(() => { load(); }, []);

  const decide = async (userId, decision) => {
    await api.post(`/admin/kyc/${userId}/decision?decision=${decision}`);
    toast.success(decision === "approve" ? "Profil approuvé" : "Profil rejeté");
    load();
  };

  const viewDoc = async (docId) => {
    // Open in new tab with auth token
    const token = localStorage.getItem("fazgom_token");
    const url = `${API}/admin/kyc/${docId}/file`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return toast.error("Erreur");
    const blob = await res.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    window.open(objectUrl, "_blank");
  };

  return (
    <div className="space-y-4" data-testid="admin-kyc-page">
      <div>
        <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Console admin</p>
        <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1 flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-[#1F4E3D]" /> Vérifications KYC
        </h1>
        <p className="text-sm text-[#6C6C6C] mt-2">Examinez les documents et approuvez les assistants comptables.</p>
      </div>

      {items.length === 0 && (
        <div className="card-flat p-10 text-center">
          <ShieldCheck className="w-12 h-12 mx-auto text-[#1F4E3D]" />
          <div className="mt-3 font-['Manrope'] font-bold">Aucune demande en attente</div>
          <div className="text-sm text-[#6C6C6C] mt-1">Tous les profils sont à jour.</div>
        </div>
      )}

      <div className="space-y-4">
        {items.map((it) => (
          <div key={it.user.id} className="card-flat p-5" data-testid={`kyc-user-${it.user.id}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="font-['Manrope'] font-bold text-lg">{it.user.display_name}</div>
                <div className="text-xs text-[#6C6C6C]">
                  {it.user.phone} · {it.user.city} · Inscrit le {it.user.created_at?.slice(0, 10)}
                </div>
                {it.user.bio && <p className="text-sm mt-2 max-w-xl">{it.user.bio}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => decide(it.user.id, "reject")} data-testid={`kyc-reject-${it.user.id}`} className="px-3 py-2 rounded-full bg-white border border-[#C84B31] text-[#C84B31] hover:bg-[#C84B31] hover:text-white text-sm font-semibold flex items-center gap-1">
                  <X className="w-4 h-4" /> Rejeter
                </button>
                <button onClick={() => decide(it.user.id, "approve")} data-testid={`kyc-approve-${it.user.id}`} className="px-3 py-2 rounded-full bg-[#1F4E3D] text-white hover:bg-[#163328] text-sm font-semibold flex items-center gap-1">
                  <Check className="w-4 h-4" /> Approuver
                </button>
              </div>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 gap-2">
              {it.documents.length === 0 && (
                <div className="text-sm text-[#6C6C6C] italic">Aucun document téléversé.</div>
              )}
              {it.documents.map((d) => (
                <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg border border-[#EAE5D9]" data-testid={`kyc-doc-row-${d.id}`}>
                  <FileText className="w-5 h-5 text-[#6C6C6C]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold flex items-center gap-1.5 flex-wrap">
                      <span>
                        {d.doc_type === "id_card" ? "Carte d'identité" : d.doc_type === "passport" ? "Passeport" : d.doc_type === "diploma" ? "Diplôme" : d.doc_type}
                      </span>
                      {d.expiry_date && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#C84B31]/10 text-[#C84B31] font-bold">
                          Expire le : {new Date(d.expiry_date).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#6C6C6C] truncate">{d.filename} · {Math.round(d.size / 1024)} Ko</div>
                  </div>
                  <button onClick={() => viewDoc(d.id)} data-testid={`view-doc-${d.id}`} className="p-2 rounded-lg hover:bg-[#EAE5D9] text-[#1F4E3D]">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
