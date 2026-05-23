import React, { useEffect, useState } from "react";
import { Megaphone, Send, Users, Store, GraduationCap, User as UserIcon, CheckCircle2, AlertTriangle, History } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const AUDIENCES = [
  { v: "all_users", icon: Users, label: "Tous les utilisateurs", desc: "Commerçants + assistants" },
  { v: "all_merchants", icon: Store, label: "Tous les commerçants", desc: "Boutiquiers/artisans" },
  { v: "all_assistants", icon: GraduationCap, label: "Tous les assistants", desc: "Licence Compta" },
  { v: "user", icon: UserIcon, label: "Un utilisateur précis", desc: "Par recherche" },
];

const STATUS_BADGE = {
  processing: { l: "En cours", c: "bg-[#ECA869] text-[#2D2D2D]" },
  completed: { l: "Terminé", c: "bg-[#1F4E3D] text-white" },
  partial: { l: "Partiel", c: "bg-[#ECA869] text-[#2D2D2D]" },
  failed: { l: "Échec", c: "bg-[#D32F2F] text-white" },
};

export default function AdminBroadcast() {
  const [audience, setAudience] = useState("all_users");
  const [message, setMessage] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);

  const loadHistory = async () => {
    const r = await api.get("/admin/broadcasts");
    setHistory(r.data);
  };
  useEffect(() => { loadHistory(); }, []);

  const searchUsers = async (q) => {
    setUserSearch(q);
    if (q.length < 2) return setSearchResults([]);
    const r = await api.get("/admin/users", { params: { q } });
    setSearchResults(r.data.slice(0, 10));
  };

  const send = async () => {
    if (!message.trim()) return toast.error("Message vide");
    if (audience === "user" && !selectedUser) return toast.error("Sélectionnez un utilisateur");
    if (!window.confirm(`Envoyer ce message WhatsApp ?\n\nAudience : ${AUDIENCES.find(a=>a.v===audience).label}${selectedUser ? ` (${selectedUser.display_name})` : ""}`)) return;
    setSending(true);
    try {
      const payload = { audience, message };
      if (audience === "user") payload.user_id = selectedUser.id;
      const r = await api.post("/admin/broadcast", payload);
      toast.success(`${r.data.queued} message(s) en file d'envoi`);
      setMessage("");
      setSelectedUser(null);
      setUserSearch("");
      setSearchResults([]);
      loadHistory();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="admin-broadcast-page">
      <div>
        <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Console admin</p>
        <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1 flex items-center gap-2">
          <Megaphone className="w-7 h-7 text-[#C84B31]" /> Diffusion WhatsApp
        </h1>
        <p className="text-sm text-[#6C6C6C] mt-2">
          Envoyez un message WhatsApp à un groupe d'utilisateurs. OpenWA gère les délais anti-ban automatiquement (3s entre chaque message).
        </p>
      </div>

      <div className="card-flat p-5 space-y-4">
        <div>
          <Label className="mb-2 block">Audience</Label>
          <div className="grid sm:grid-cols-2 gap-2">
            {AUDIENCES.map((a) => (
              <button
                key={a.v}
                type="button"
                onClick={() => setAudience(a.v)}
                data-testid={`audience-${a.v}`}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition ${
                  audience === a.v ? "border-[#C84B31] bg-[#C84B31]/5" : "border-[#EAE5D9] bg-white hover:border-[#C84B31]/40"
                }`}
              >
                <a.icon className={`w-5 h-5 mt-0.5 ${audience === a.v ? "text-[#C84B31]" : "text-[#6C6C6C]"}`} />
                <div className="min-w-0">
                  <div className="font-['Manrope'] font-bold text-sm">{a.label}</div>
                  <div className="text-xs text-[#6C6C6C]">{a.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {audience === "user" && (
          <div>
            <Label>Rechercher l'utilisateur</Label>
            <Input
              data-testid="broadcast-user-search"
              value={userSearch}
              onChange={(e) => searchUsers(e.target.value)}
              placeholder="Nom, boutique ou téléphone"
              className="h-11"
            />
            {searchResults.length > 0 && !selectedUser && (
              <div className="mt-2 card-flat divide-y divide-[#EAE5D9] max-h-60 overflow-y-auto">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setSelectedUser(u); setSearchResults([]); setUserSearch(u.display_name); }}
                    data-testid={`select-user-${u.id}`}
                    className="w-full p-2.5 text-left hover:bg-[#FAF8F5] flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-sm">{u.display_name}</div>
                      <div className="text-xs text-[#6C6C6C]">{u.phone} · {u.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedUser && (
              <div className="mt-2 p-2.5 rounded-lg bg-[#1F4E3D]/10 border border-[#1F4E3D]/20 flex items-center justify-between" data-testid="selected-user-pill">
                <div className="text-sm">
                  <strong>{selectedUser.display_name}</strong>
                  <span className="text-[#6C6C6C] text-xs ml-2">{selectedUser.phone}</span>
                </div>
                <button onClick={() => { setSelectedUser(null); setUserSearch(""); }} className="text-xs text-[#C84B31]">Changer</button>
              </div>
            )}
          </div>
        )}

        <div>
          <Label>Message WhatsApp</Label>
          <Textarea
            data-testid="broadcast-message-input"
            rows={5}
            maxLength={5000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={"Bonjour 👋\n\nNouveauté Kaba-Compta : ...\n\nMerci de votre confiance !"}
          />
          <div className="text-xs text-[#6C6C6C] mt-1 flex justify-between">
            <span>Astuce : *texte* pour gras, _texte_ pour italique (formatage WhatsApp)</span>
            <span>{message.length} / 5000</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
          <div className="text-xs text-[#6C6C6C] flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-[#ECA869]" />
            Les utilisateurs suspendus ne reçoivent pas le message.
          </div>
          <Button
            onClick={send}
            disabled={sending}
            data-testid="broadcast-send-btn"
            className="bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-full h-11"
          >
            <Send className="w-4 h-4 mr-1" /> {sending ? "Envoi..." : "Envoyer la diffusion"}
          </Button>
        </div>
      </div>

      {/* History */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <History className="w-5 h-5 text-[#6C6C6C]" />
          <h2 className="font-['Manrope'] font-bold">Historique</h2>
        </div>
        <div className="card-flat divide-y divide-[#EAE5D9]">
          {history.length === 0 && <div className="p-6 text-center text-[#6C6C6C] text-sm">Aucune diffusion encore.</div>}
          {history.map((b) => {
            const st = STATUS_BADGE[b.status] || { l: b.status, c: "bg-gray-200" };
            return (
              <div key={b.id} className="p-3" data-testid={`broadcast-${b.id}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-xs text-[#6C6C6C]">
                      {new Date(b.created_at).toLocaleString("fr-FR")} · par {b.admin_name || "admin"}
                    </div>
                    <div className="font-['Manrope'] font-semibold text-sm mt-0.5">
                      {AUDIENCES.find((a) => a.v === b.audience)?.label || b.audience}
                      <span className="text-[#6C6C6C] text-xs ml-2">· {b.total_targets} destinataire(s)</span>
                    </div>
                    <p className="text-sm mt-1 line-clamp-2 max-w-2xl">{b.message}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${st.c}`}>{st.l}</span>
                    <div className="text-xs text-[#6C6C6C]">
                      <span className="text-[#1F4E3D] font-semibold">{b.queued || 0}</span> envoyés
                      {b.failed > 0 && <span className="text-[#C84B31] ml-2">· {b.failed} échec(s)</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
