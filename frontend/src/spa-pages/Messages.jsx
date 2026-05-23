import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, fmtFCFA } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const STATUS_LABELS = {
  ouverte: "Ouverte",
  en_discussion: "En discussion",
  en_travail: "En cours",
  terminee: "Terminée",
  annulee: "Annulée",
};

export default function Messages() {
  const { user } = useAuth();
  const [conv, setConv] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const loadConv = async () => {
    const r = await api.get("/conversations");
    setConv(r.data);
  };

  const loadMessages = async (offerId) => {
    const r = await api.get(`/offers/${offerId}/messages`);
    setMessages(r.data);
  };

  useEffect(() => {
    loadConv();
  }, []);

  useEffect(() => {
    if (!active) return;
    loadMessages(active.offer_id);
    const t = setInterval(() => loadMessages(active.offer_id), 10000);
    return () => clearInterval(t);
  }, [active]);

  const send = async () => {
    if (!text.trim() || !active) return;
    try {
      await api.post(`/offers/${active.offer_id}/messages`, { body: text });
      setText("");
      loadMessages(active.offer_id);
      loadConv();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div className="space-y-4" data-testid="messages-page">
      <div>
        <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Messagerie</p>
        <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1">Mes conversations</h1>
        <p className="text-sm text-[#6C6C6C] mt-1">
          Une conversation par offre. Négociez prix, délais, livrables.
        </p>
      </div>

      {conv.length === 0 && (
        <div className="card-flat p-8 text-center">
          <MessageCircle className="w-10 h-10 text-[#6C6C6C] mx-auto" />
          <div className="text-[#6C6C6C] mt-3">Aucune conversation pour le moment.</div>
          <Link to="/app/missions" className="text-sm text-[#C84B31] mt-2 inline-block">
            Voir les missions →
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-[320px_1fr] gap-3">
        <div className="space-y-2">
          {conv.map((c) => (
            <button
              key={c.offer_id}
              onClick={() => setActive(c)}
              data-testid={`conv-${c.offer_id}`}
              className={`block w-full text-left card-flat p-3 transition ${active?.offer_id === c.offer_id ? "border-[#C84B31] bg-[#C84B31]/5" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-['Manrope'] font-bold truncate">{c.mission_title}</div>
                <span className="text-xs text-[#6C6C6C] shrink-0">{STATUS_LABELS[c.mission_status]}</span>
              </div>
              <div className="text-xs text-[#6C6C6C] mt-0.5 truncate">
                {user.role === "merchant" ? `Offre de ${c.assistant_name}` : `Mission de ${c.merchant_name}`}
                {c.price_fcfa && ` · ${fmtFCFA(c.price_fcfa)}`}
              </div>
              {c.last_message ? (
                <div className="text-sm text-[#2D2D2D]/80 mt-1 line-clamp-1">{c.last_message.body}</div>
              ) : (
                <div className="text-sm text-[#6C6C6C] mt-1 italic">Pas encore de messages</div>
              )}
            </button>
          ))}
        </div>

        {active && (
          <div className="card-flat p-4 flex flex-col h-[70vh]" data-testid="messages-chat">
            <div className="font-['Manrope'] font-bold mb-2 flex items-center justify-between">
              <span>{active.mission_title}</span>
              <Link to={`/app/missions/${active.mission_id}`} className="text-xs text-[#C84B31]">Voir la mission →</Link>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto" data-testid="chat-list">
              {messages.length === 0 && <div className="text-sm text-[#6C6C6C]">Aucun message.</div>}
              {messages.map((m) => {
                const me = m.sender_id === user.id;
                return (
                  <div key={m.id} className={`flex ${me ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-3 py-2 ${me ? "bubble-self" : "bubble-other"}`}>
                      {!me && <div className="text-xs font-bold text-[#1F4E3D]">{m.sender_name}</div>}
                      <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                      <div className="text-[10px] text-[#6C6C6C] text-right mt-1">
                        {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Écrire un message..."
                className="h-11"
                data-testid="chat-input"
              />
              <Button onClick={send} data-testid="send-msg-btn" className="bg-[#1F4E3D] hover:bg-[#163328] text-white rounded-full h-11 w-11 p-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
