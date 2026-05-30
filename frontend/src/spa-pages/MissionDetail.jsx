import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapPin, Crown, Star, Send, MessageCircle, CheckCircle2, XCircle, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { api, fmtFCFA } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const CONTRACT_LABELS = {
  ponctuelle: "Mission ponctuelle",
  saisonnier: "Renfort saisonnier",
  stage: "Stage professionnel",
  cdd: "CDD",
  cdi: "CDI",
};

const LEVEL_LABELS = {
  junior: "Junior",
  intermediaire: "Intermédiaire",
  senior: "Senior",
};

const formatCompactBudget = (n) => Number(n || 0).toLocaleString("fr-FR").replaceAll(" ", ".").replaceAll(" ", ".");

const TAG_CLASS = "px-2 py-0.5 rounded-full font-semibold";
const CONTRACT_TAG = `${TAG_CLASS} bg-white/75 text-[#2D2D2D] border border-[#D9D1C3]`;
const LEVEL_TAG = `${TAG_CLASS} bg-[#ECA869]/20 text-[#2D2D2D] border border-[#ECA869]/40`;
const REMOTE_TAG = `${TAG_CLASS} bg-[#FFF4E3] text-[#A8661F] border border-[#ECA869]`;

const STATUS_LABELS = {
  ouverte: { l: "", c: "bg-[#1F4E3D] text-white", style: { background: "#EAF5EE", borderColor: "#1F4E3D", borderWidth: 2 } },
  en_discussion: { l: "", c: "bg-[#1F4E3D] text-white", style: { background: "#EAF5EE", borderColor: "#1F4E3D", borderWidth: 2 } },
  en_travail: { l: "En cours", c: "bg-[#1F4E3D] text-white", style: { background: "#EAF5EE", borderColor: "#1F4E3D", borderWidth: 2 } },
  terminee: { l: "Terminée", c: "bg-[#ECA869] text-[#2D2D2D]", style: { background: "#FFF4E3", borderColor: "#ECA869", borderWidth: 2 } },
  annulee: { l: "Fermé", c: "bg-[#D32F2F] text-white", style: { background: "#FFF1F1", borderColor: "#D32F2F", borderWidth: 2 } },
};

export default function MissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mission, setMission] = useState(null);
  const [offers, setOffers] = useState([]);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});

  const isMerchant = user?.id === mission?.merchant_id;
  const isAssistant = user?.role === "assistant";
  const isSelectedAssistant = user?.id === mission?.selected_assistant_id;
  const canOffer = isAssistant && !isMerchant && mission && ["ouverte", "en_discussion"].includes(mission.status);

  const load = async () => {
    const r = await api.get(`/missions/${id}`);
    setMission(r.data);
    if (r.data.merchant_id === user.id || user.role === "admin") {
      const aps = await api.get(`/missions/${id}/offers`);
      setOffers(aps.data);
    } else if (r.data.my_offer) {
      setOffers([r.data.my_offer]);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [id]);

  if (!mission) return <div className="text-[#6C6C6C]">Chargement...</div>;

  const status = STATUS_LABELS[mission.status] || { l: mission.status, c: "bg-gray-200" };
  const budget = (mission.budget_min_fcfa != null && mission.budget_max_fcfa != null)
    ? (mission.budget_min_fcfa === mission.budget_max_fcfa
      ? fmtFCFA(mission.budget_min_fcfa)
      : fmtFCFA(mission.budget_min_fcfa) + " – " + fmtFCFA(mission.budget_max_fcfa))
    : mission.budget_min_fcfa != null
      ? "À partir de " + fmtFCFA(mission.budget_min_fcfa)
      : mission.budget_max_fcfa != null
        ? "<" + formatCompactBudget(mission.budget_max_fcfa) + " FCFA"
        : "Budget à discuter";

  const cancel = async () => {
    if (!window.confirm("Fermer cette mission ?")) return;
    await api.post(`/missions/${id}/cancel`);
    toast.success("Mission fermée");
    load();
  };

  const openEdit = () => {
    setEditForm({
      title: mission.title || "",
      type: mission.type || "autre",
      location: mission.location || "Lomé",
      description: mission.description || "",
      budget_min_fcfa: mission.budget_min_fcfa ?? "",
      budget_max_fcfa: mission.budget_max_fcfa ?? "",
      contract_type: mission.contract_type || "ponctuelle",
      level: mission.level || "intermediaire",
      remote_ok: Boolean(mission.remote_ok),
    });
    setEditOpen(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    const payload = { ...editForm };
    payload.budget_min_fcfa = payload.budget_min_fcfa === "" ? null : Number(payload.budget_min_fcfa);
    payload.budget_max_fcfa = payload.budget_max_fcfa === "" ? null : Number(payload.budget_max_fcfa);
    await api.put(`/missions/${id}`, payload);
    toast.success("Mission modifiée");
    setEditOpen(false);
    load();
  };

  const deleteMission = async () => {
    if (!window.confirm("Supprimer définitivement cette mission ?")) return;
    await api.delete(`/missions/${id}`);
    toast.success("Mission supprimée");
    navigate("/app/missions");
  };

  const complete = async () => {
    if (!window.confirm("Marquer la mission comme terminée ?")) return;
    await api.post(`/missions/${id}/complete`);
    toast.success("Mission terminée");
    load();
    setReviewOpen(true);
  };

  const selectOffer = async (offerId) => {
    if (!window.confirm("Attribuer la mission à ce comptable ? Les autres offres seront refusées.")) return;
    await api.post(`/missions/${id}/select-offer/${offerId}`);
    toast.success("Offre acceptée. Vous pouvez maintenant discuter.");
    load();
  };

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await api.post("/reviews", {
        mission_id: id,
        stars: reviewStars,
        comment: reviewComment,
      });
      toast.success("Avis enregistré, merci !");
      setReviewOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div className="space-y-4" data-testid="mission-detail-page">
      <Link to="/app/missions" className="text-sm text-[#6C6C6C]" data-testid="back-link">← Retour</Link>

      <div className="card-flat p-5" style={status.style}>
        <div className="space-y-3">
          <div className="min-w-0">
            <h1 className="font-['Manrope'] font-extrabold text-2xl leading-tight">{mission.title}</h1>
            <div className="text-sm text-[#6C6C6C] mt-1">
              Par <strong>{mission.merchant_shop || mission.merchant_name}</strong>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#6C6C6C] mt-2 flex-wrap">
              <span className="capitalize bg-[#EAE5D9] px-2 py-0.5 rounded-full">{mission.type?.replace(/_/g, " ")}</span>
              <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {mission.location}</span>
              <span className={CONTRACT_TAG}>{CONTRACT_LABELS[mission.contract_type] || mission.contract_type}</span>
              <span className={LEVEL_TAG}>{LEVEL_LABELS[mission.level] || mission.level}</span>
              {mission.remote_ok && <span className={REMOTE_TAG}>Télétravail</span>}
              {status.l && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${status.c}`}>{status.l}</span>}
            </div>
          </div>
          <div className="pt-1">
            <div className="font-['Manrope'] font-extrabold text-lg text-[#C84B31] break-words">{budget}</div>
            {mission.agreed_price_fcfa && (
              <div className="text-xs text-[#1F4E3D] mt-1">
                Prix convenu : {fmtFCFA(mission.agreed_price_fcfa)} ({mission.agreed_delivery_days}j)
              </div>
            )}
          </div>
        </div>
        <p className="mt-4 text-[#2D2D2D] whitespace-pre-wrap">{mission.description}</p>

        {/* Merchant actions */}
        {isMerchant && ["ouverte", "en_discussion"].includes(mission.status) && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button onClick={openEdit} variant="outline" data-testid="edit-mission-btn">
              <Edit2 className="w-4 h-4 mr-1" /> Modifier
            </Button>
            <Button onClick={cancel} variant="outline" data-testid="cancel-mission-btn">
              <XCircle className="w-4 h-4 mr-1" /> Fermer la mission
            </Button>
            <Button onClick={deleteMission} variant="outline" data-testid="delete-mission-btn" className="text-[#D32F2F] border-[#D32F2F]/30 hover:bg-[#D32F2F]/10">
              <Trash2 className="w-4 h-4 mr-1" /> Supprimer
            </Button>
          </div>
        )}

        {isMerchant && mission.status === "annulee" && (
          <Button onClick={deleteMission} variant="outline" data-testid="delete-mission-btn" className="mt-4 text-[#D32F2F] border-[#D32F2F]/30 hover:bg-[#D32F2F]/10">
            <Trash2 className="w-4 h-4 mr-1" /> Supprimer
          </Button>
        )}

        {isMerchant && mission.status === "en_travail" && (
          <Button onClick={complete} data-testid="complete-mission-btn" className="mt-5 w-full h-12 bg-[#1F4E3D] hover:bg-[#163328] text-white rounded-xl">
            <CheckCircle2 className="w-5 h-5 mr-2" /> Marquer comme terminée
          </Button>
        )}

        {mission.status === "terminee" && (isMerchant || isSelectedAssistant) && (
          mission.user_has_reviewed ? (
            <div className="mt-5 w-full py-3 bg-[#1F4E3D]/5 border border-[#1F4E3D]/20 text-[#1F4E3D] rounded-xl text-center font-semibold text-sm flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Avis déjà enregistré pour cette mission
            </div>
          ) : (
            <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
              <DialogTrigger asChild>
                <Button data-testid="open-review-btn" className="mt-5 w-full h-11 bg-[#ECA869] hover:bg-[#d99151] text-[#2D2D2D] rounded-xl">
                  <Star className="w-4 h-4 mr-1" /> Laisser un avis
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Votre avis</DialogTitle></DialogHeader>
                <form onSubmit={submitReview} className="space-y-3" data-testid="review-form">
                  <div>
                    <Label>Note (1-5)</Label>
                    <div className="flex gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setReviewStars(n)}
                          data-testid={`star-${n}`}
                        >
                          <Star className={`w-7 h-7 ${n <= reviewStars ? "fill-[#ECA869] text-[#ECA869]" : "text-[#EAE5D9]"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Commentaire</Label>
                    <Textarea rows={3} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} data-testid="review-comment-input" />
                  </div>
                  <Button type="submit" data-testid="submit-review-btn" className="w-full h-11 bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-xl">
                    Envoyer
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier la mission</DialogTitle></DialogHeader>
          <form onSubmit={saveEdit} className="space-y-3" data-testid="edit-mission-form">
            <div>
              <Label>Titre</Label>
              <Input value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <select value={editForm.type || "autre"} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className="h-10 w-full rounded-md border border-[#EAE5D9] bg-white px-3 text-sm">
                  <option value="caisse">Point de caisse</option>
                  <option value="inventaire">Inventaire stock</option>
                  <option value="audit">Audit / Rapport</option>
                  <option value="fiscal">Fiscal / TVA</option>
                  <option value="paie">Paie</option>
                  <option value="creation_entreprise">Création d'entreprise</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div>
                <Label>Ville</Label>
                <Input value={editForm.location || ""} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={4} value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prix minimum</Label>
                <Input type="number" value={editForm.budget_min_fcfa ?? ""} onChange={(e) => setEditForm({ ...editForm, budget_min_fcfa: e.target.value })} />
              </div>
              <div>
                <Label>Prix maximum</Label>
                <Input type="number" value={editForm.budget_max_fcfa ?? ""} onChange={(e) => setEditForm({ ...editForm, budget_max_fcfa: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type de contrat</Label>
                <select value={editForm.contract_type || "ponctuelle"} onChange={(e) => setEditForm({ ...editForm, contract_type: e.target.value })} className="h-10 w-full rounded-md border border-[#EAE5D9] bg-white px-3 text-sm">
                  <option value="ponctuelle">Mission ponctuelle</option>
                  <option value="saisonnier">Renfort saisonnier</option>
                  <option value="stage">Stage professionnel</option>
                  <option value="cdd">CDD</option>
                  <option value="cdi">CDI</option>
                </select>
              </div>
              <div>
                <Label>Niveau</Label>
                <select value={editForm.level || "intermediaire"} onChange={(e) => setEditForm({ ...editForm, level: e.target.value })} className="h-10 w-full rounded-md border border-[#EAE5D9] bg-white px-3 text-sm">
                  <option value="junior">Junior</option>
                  <option value="intermediaire">Intermédiaire</option>
                  <option value="senior">Senior</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-[#2D2D2D]">
              <input type="checkbox" checked={Boolean(editForm.remote_ok)} onChange={(e) => setEditForm({ ...editForm, remote_ok: e.target.checked })} />
              Télétravail autorisé
            </label>
            <Button type="submit" className="w-full h-11 bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-xl">Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Offer form (assistant) */}
      {canOffer && <OfferForm missionId={id} existingOffer={mission.my_offer} onSaved={load} />}

      {/* Offers list (merchant) */}
      {(isMerchant || user.role === "admin") && (
        <div>
          <h2 className="font-['Manrope'] font-bold text-lg mb-2">
            Offres reçues ({offers.length})
          </h2>
          {offers.length === 0 && (
            <div className="card-flat p-4 text-sm text-[#6C6C6C]">
              Aucune offre pour l'instant. Les comptables verront votre annonce dans leur fil.
            </div>
          )}
          <div className="space-y-2">
            {offers.map((o) => (
              <OfferCard
                key={o.id}
                offer={o}
                missionStatus={mission.status}
                canSelect={isMerchant && ["ouverte", "en_discussion"].includes(mission.status)}
                onSelect={() => selectOffer(o.id)}
                onOpenChat={() => setSelectedOffer(o)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Own offer if assistant */}
      {isAssistant && !isMerchant && mission.my_offer && (
        <div className="card-flat p-4 bg-[#1F4E3D]/5">
          <div className="font-['Manrope'] font-bold mb-2">Votre offre</div>
          <OfferCard
            offer={mission.my_offer}
            missionStatus={mission.status}
            canSelect={false}
            isOwn
            onOpenChat={() => setSelectedOffer(mission.my_offer)}
          />
        </div>
      )}

      {/* Chat panel */}
      {selectedOffer && (
        <OfferChat
          offer={selectedOffer}
          mission={mission}
          onClose={() => setSelectedOffer(null)}
        />
      )}
    </div>
  );
}

function OfferForm({ missionId, existingOffer, onSaved }) {
  const [form, setForm] = useState({
    price_fcfa: existingOffer?.price_fcfa || "",
    delivery_days: existingOffer?.delivery_days || 3,
    message: existingOffer?.message || "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.price_fcfa || !form.delivery_days) return;
    setSaving(true);
    try {
      await api.post(`/missions/${missionId}/offers`, {
        price_fcfa: parseFloat(form.price_fcfa),
        delivery_days: parseInt(form.delivery_days, 10),
        message: form.message,
      });
      toast.success(existingOffer ? "Offre mise à jour" : "Offre envoyée");
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card-flat p-4 space-y-3" data-testid="offer-form">
      <h2 className="font-['Manrope'] font-bold">
        {existingOffer ? "Modifier mon offre" : "Faire une offre"}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Prix proposé (FCFA) <span className="text-[#C84B31]">*</span></Label>
          <Input
            type="number"
            value={form.price_fcfa}
            onChange={(e) => setForm({ ...form, price_fcfa: e.target.value })}
            required
            min="100"
            className="h-11"
            data-testid="offer-price-input"
            placeholder="10000"
          />
        </div>
        <div>
          <Label>Délai (jours) <span className="text-[#C84B31]">*</span></Label>
          <Input
            type="number"
            value={form.delivery_days}
            onChange={(e) => setForm({ ...form, delivery_days: e.target.value })}
            required
            min="1"
            className="h-11"
            data-testid="offer-delivery-input"
          />
        </div>
      </div>
      <div>
        <Label>Message de présentation <span className="text-[#C84B31]">*</span></Label>
        <Textarea
          rows={3}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Présentez votre expertise, votre méthode, vos références..."
          data-testid="offer-message-input"
        />
      </div>
      <Button
        type="submit"
        disabled={saving}
        data-testid="offer-submit-btn"
        className="w-full h-11 bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-xl"
      >
        {saving ? "Envoi..." : existingOffer ? <><Edit2 className="w-4 h-4 mr-1" /> Mettre à jour mon offre</> : "Envoyer mon offre"}
      </Button>
      {existingOffer?.history?.length > 0 && (
        <div className="text-xs text-[#6C6C6C]">
          Historique : {existingOffer.history.length} version(s) précédente(s)
        </div>
      )}
    </form>
  );
}

function OfferCard({ offer, canSelect, isOwn, onSelect, onOpenChat }) {
  const statusBadge = {
    active: { l: "En attente", c: "bg-[#ECA869]/20 text-[#2D2D2D]" },
    selected: { l: "Retenue", c: "bg-[#1F4E3D] text-white" },
    not_selected: { l: "Non retenue", c: "bg-[#6C6C6C]/20 text-[#6C6C6C]" },
  }[offer.status] || { l: offer.status, c: "bg-gray-200" };

  return (
    <div className="card-flat p-4" data-testid={`offer-${offer.id}`}>
      <div className="space-y-3">
        <div className="min-w-0">
          <div className="font-['Manrope'] font-bold flex items-center gap-2">
            {offer.assistant_name}
            {offer.assistant_is_premium && <Crown className="w-4 h-4 text-[#ECA869]" />}
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge.c}`}>{statusBadge.l}</span>
          </div>
          <div className="text-xs text-[#6C6C6C] flex items-center gap-1 mt-1">
            <Star className="w-3 h-3 fill-[#ECA869] text-[#ECA869]" />
            {offer.assistant_rating || "Nouveau"}
          </div>
        </div>
        <div className="pt-1">
          <div className="font-['Manrope'] font-bold text-[#C84B31]">{fmtFCFA(offer.price_fcfa)}</div>
          <div className="text-xs text-[#6C6C6C]">{offer.delivery_days} jour{offer.delivery_days > 1 ? "s" : ""}</div>
        </div>
      </div>
      {offer.message && <p className="text-sm mt-2 whitespace-pre-wrap">{offer.message}</p>}
      <div className="flex gap-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenChat}
          data-testid={`open-chat-${offer.id}`}
        >
          <MessageCircle className="w-4 h-4 mr-1" /> Discuter
        </Button>
        {canSelect && (
          <Button
            size="sm"
            onClick={onSelect}
            data-testid={`select-offer-${offer.id}`}
            className="bg-[#1F4E3D] hover:bg-[#163328] text-white"
          >
            Retenir cette offre
          </Button>
        )}
        {isOwn && offer.history?.length > 0 && (
          <span className="text-xs text-[#6C6C6C] self-center">
            {offer.history.length} version(s) précédente(s)
          </span>
        )}
      </div>
    </div>
  );
}

function OfferChat({ offer, mission, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const load = async () => {
    try {
      const r = await api.get(`/offers/${offer.id}/messages`);
      setMessages(r.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [offer.id]);

  const send = async () => {
    if (!text.trim()) return;
    try {
      await api.post(`/offers/${offer.id}/messages`, { body: text });
      setText("");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div className="card-flat p-4 fixed inset-x-2 bottom-2 z-30 max-w-3xl mx-auto bg-white shadow-xl" data-testid="offer-chat">
      <div className="flex items-center justify-between mb-2">
        <div className="font-['Manrope'] font-bold text-sm flex items-center gap-1">
          <MessageCircle className="w-4 h-4" /> Discussion : {offer.assistant_name} ↔ {mission.merchant_name}
        </div>
        <button onClick={onClose} className="text-[#6C6C6C] text-sm" data-testid="close-chat">✕</button>
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto" data-testid="chat-list">
        {messages.length === 0 && <div className="text-sm text-[#6C6C6C]">Démarrez la conversation.</div>}
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
  );
}
