import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MessageCircle, Flag, Trash2, Share2, Copy, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const roleLabel = (r) =>
  r === "merchant" ? "Marchand" : r === "assistant" ? "Comptable" : r === "admin" ? "Admin" : "";

const renderAvatar = (avatarUrl, name, size = "w-10 h-10 text-base") => {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${size} rounded-full object-cover border border-[#EAE5D9]`} />;
  }
  return (
    <div className={`${size} rounded-full bg-[#1F4E3D] text-white font-bold grid place-items-center`}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
};

function ReactionSection({ targetType, targetId, subReplyId, reactions, onReact, userId }) {
  const emojis = ["👍", "❤️", "😂", "😮", "😢", "👏"];
  const [showPicker, setShowPicker] = useState(false);

  const activeReactions = Object.entries(reactions || {}).filter(([_, users]) => users.length > 0);
  const totalCount = activeReactions.reduce((acc, [_, users]) => acc + users.length, 0);
  const myReact = Object.keys(reactions || {}).find((emoji) => (reactions[emoji] || []).includes(userId));

  const handleEmojiClick = (emoji) => {
    onReact(targetType, targetId, subReplyId, emoji);
    setShowPicker(false);
  };

  return (
    <div className="relative flex flex-wrap items-center gap-2 min-w-0">
      <button
        type="button"
        onClick={() => setShowPicker((open) => !open)}
        className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-bold shadow-sm transition ${
          myReact
            ? "border-[#C84B31]/30 bg-[#C84B31]/10 text-[#C84B31]"
            : "border-[#EAE5D9] bg-white text-[#2D2D2D] hover:border-[#C84B31]/40 hover:text-[#C84B31]"
        }`}
      >
        <span className="text-lg leading-none">{myReact || "👍"}</span>
        <span>{myReact ? "Réagi" : "Réagir"}</span>
      </button>

      {totalCount > 0 && (
        <div className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#EAE5D9] bg-[#FAF8F5] px-3 text-xs font-bold text-[#6C6C6C]">
          <span className="flex gap-1 text-sm">{activeReactions.map(([emoji]) => <span key={emoji}>{emoji}</span>)}</span>
          <span>{totalCount}</span>
        </div>
      )}

      {showPicker && (
        <div className="absolute left-0 top-11 z-50 flex items-center gap-2 rounded-2xl border border-[#EAE5D9] bg-white p-2 shadow-xl">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleEmojiClick(emoji)}
              className="grid h-10 w-10 place-items-center rounded-full text-2xl transition hover:bg-[#FAF8F5] hover:scale-110"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ForumActionModal({ modal, saving, onClose, onSubmit }) {
  const [draft, setDraft] = useState(modal?.values || {});

  useEffect(() => {
    setDraft(modal?.values || {});
  }, [modal]);

  if (!modal) return null;

  const isReport = modal.kind.includes("report");
  const isQuestionEdit = modal.kind === "edit-question";
  const isAnswerEdit = modal.kind === "edit-answer";

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 px-4" role="dialog" aria-modal="true">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(draft);
        }}
        className="w-full max-w-lg rounded-2xl border border-[#EAE5D9] bg-white p-5 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-['Manrope'] text-xl font-extrabold text-[#2D2D2D]">{modal.title}</h3>
            <p className="mt-1 text-sm text-[#6C6C6C]">{modal.description}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-sm font-bold text-[#6C6C6C] hover:bg-[#FAF8F5]">Fermer</button>
        </div>

        {isQuestionEdit && (
          <>
            <label className="block text-sm font-bold text-[#2D2D2D]">
              Titre
              <input
                value={draft.title || ""}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl border border-[#EAE5D9] bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C84B31]/20"
              />
            </label>
            <label className="block text-sm font-bold text-[#2D2D2D]">
              Contenu
              <textarea
                rows={5}
                value={draft.body || ""}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#EAE5D9] bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C84B31]/20"
              />
            </label>
            <label className="block text-sm font-bold text-[#2D2D2D]">
              Tags
              <input
                value={draft.tagsText || ""}
                onChange={(e) => setDraft({ ...draft, tagsText: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl border border-[#EAE5D9] bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C84B31]/20"
                placeholder="comptabilité, fiscalité"
              />
            </label>
          </>
        )}

        {isAnswerEdit && (
          <label className="block text-sm font-bold text-[#2D2D2D]">
            Réponse
            <textarea
              rows={5}
              value={draft.body || ""}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#EAE5D9] bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C84B31]/20"
            />
          </label>
        )}

        {isReport && (
          <label className="block text-sm font-bold text-[#2D2D2D]">
            Motif du signalement
            <textarea
              rows={4}
              value={draft.reason || ""}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#EAE5D9] bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C84B31]/20"
              placeholder="Expliquez brièvement le problème..."
            />
          </label>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-11 rounded-full border border-[#EAE5D9] px-5 text-sm font-bold text-[#2D2D2D] hover:bg-[#FAF8F5]">Annuler</button>
          <button type="submit" disabled={saving} className="h-11 rounded-full bg-[#C84B31] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#A83E28] disabled:opacity-60">
            {saving ? "Enregistrement..." : modal.submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ForumQuestionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState(null);
  const [answer, setAnswer] = useState("");
  const [posting, setPosting] = useState(false);
  const [actionModal, setActionModal] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);

  const load = async () => {
    try {
      const r = await api.get(`/forum/questions/${id}`);
      setQ(r.data);
    } catch {
      toast.error("Question introuvable");
      navigate("/app/forum");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [id]);

  if (!q) return <div className="text-[#6C6C6C]">Chargement...</div>;

  const isAuthor = user.id === q.author_id;
  const isAdmin = user.role === "admin";

  const reportQ = () => setActionModal({
    kind: "report-question",
    title: "Signaler la question",
    description: "Votre signalement sera transmis aux modérateurs.",
    submitLabel: "Envoyer le signalement",
    values: { reason: "" },
  });

  const deleteQ = async () => {
    if (!window.confirm("Supprimer la question (et toutes les réponses) ?")) return;
    await api.delete(`/forum/questions/${id}`);
    toast.success("Supprimé");
    navigate("/app/forum");
  };

  const editQ = () => setActionModal({
    kind: "edit-question",
    title: "Modifier la question",
    description: "Mettez à jour le titre, le contenu ou les tags.",
    submitLabel: "Enregistrer",
    values: { title: q.title, body: q.body, tagsText: (q.tags || []).join(", ") },
  });

  const submitAnswer = async (e) => {
    e.preventDefault();
    if (answer.trim().length < 5) return toast.error("Réponse trop courte");
    setPosting(true);
    try {
      await api.post(`/forum/questions/${id}/answers`, { body: answer });
      setAnswer("");
      toast.success("Réponse publiée");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setPosting(false);
    }
  };

  const reportA = (aid) => setActionModal({
    kind: "report-answer",
    targetId: aid,
    title: "Signaler la réponse",
    description: "Votre signalement sera transmis aux modérateurs.",
    submitLabel: "Envoyer le signalement",
    values: { reason: "" },
  });

  const deleteA = async (aid) => {
    if (!window.confirm("Supprimer cette réponse ?")) return;
    await api.delete(`/forum/answers/${aid}`);
    load();
  };

  const editA = (ans) => setActionModal({
    kind: "edit-answer",
    targetId: ans.id,
    title: "Modifier la réponse",
    description: "Corrigez le contenu de votre réponse.",
    submitLabel: "Enregistrer",
    values: { body: ans.body },
  });

  const handleReact = async (type, targetId, subReplyId, emoji) => {
    try {
      if (type === "question") {
        await api.post(`/forum/questions/${targetId}/react`, { emoji });
      } else if (type === "answer") {
        await api.post(`/forum/answers/${targetId}/react`, { emoji });
      } else if (type === "subreply") {
        await api.post(`/forum/answers/${targetId}/replies/${subReplyId}/react`, { emoji });
      }
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur de réaction");
    }
  };

  const submitReply = async (answerId, body) => {
    try {
      await api.post(`/forum/answers/${answerId}/replies`, { body });
      toast.success("Commentaire ajouté");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  const submitActionModal = async (draft) => {
    if (!actionModal) return;
    setModalSaving(true);
    try {
      if (actionModal.kind === "report-question") {
        if (!draft.reason?.trim()) return toast.error("Ajoutez un motif");
        await api.post(`/forum/questions/${id}/report`, { reason: draft.reason.trim() });
        toast.success("Signalement transmis aux modérateurs");
      } else if (actionModal.kind === "report-answer") {
        if (!draft.reason?.trim()) return toast.error("Ajoutez un motif");
        await api.post(`/forum/answers/${actionModal.targetId}/report`, { reason: draft.reason.trim() });
        toast.success("Signalement transmis");
      } else if (actionModal.kind === "edit-question") {
        const title = draft.title?.trim();
        const body = draft.body?.trim();
        if (!title || title.length < 5) return toast.error("Titre trop court");
        if (!body || body.length < 10) return toast.error("Question trop courte");
        const tags = (draft.tagsText || "").split(",").map((t) => t.trim()).filter(Boolean);
        await api.put(`/forum/questions/${id}`, { title, body, tags });
        toast.success("Question modifiée");
        load();
      } else if (actionModal.kind === "edit-answer") {
        const body = draft.body?.trim();
        if (!body || body.length < 5) return toast.error("Réponse trop courte");
        await api.put(`/forum/answers/${actionModal.targetId}`, { body });
        toast.success("Réponse modifiée");
        load();
      }
      setActionModal(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Action impossible");
    } finally {
      setModalSaving(false);
    }
  };

  const shareUrl = window.location.href;
  const shareText = `Question Forum : "${q?.title}" sur Kaba-Compta Togo`;

  const shareOnWhatsapp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`, "_blank");
  };

  const shareOnFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank");
  };

  const shareOnLinkedin = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, "_blank");
  };

  const shareOnTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Lien copié dans le presse-papiers !");
  };

  return (
    <div className="space-y-5" data-testid="question-detail-page">
      <Link to="/app/forum" className="text-sm text-[#6C6C6C]" data-testid="back-to-forum">← Retour au forum</Link>

      {/* Question */}
      <div className="card-flat p-5">
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              {renderAvatar(q.author_avatar, q.author_name)}
              <div>
                <h1 className="font-['Manrope'] font-extrabold text-lg leading-tight">{q.title}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#6C6C6C]">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span>par <strong>{q.author_name}</strong></span>
                    {q.author_role === "assistant" && q.author_kyc_status === "approved" && (
                      <span className="inline-flex items-center gap-0.5 bg-[#1F4E3D] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-sm" title="Comptable Vérifié (KYC)">
                        Pro
                      </span>
                    )}
                    <span>({roleLabel(q.author_role)})</span>
                  </span>
                  <span>•</span>
                  <span>{new Date(q.created_at).toLocaleDateString("fr-FR")}</span>
                </div>
              </div>
            </div>
            
            <div className="mt-4 text-[#2D2D2D] whitespace-pre-wrap">{q.body}</div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(q.tags || []).map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-[#1F4E3D]/10 text-[#1F4E3D]">
                  #{t}
                </span>
              ))}
            </div>

            {/* Social Share section */}
            <div className="flex flex-wrap items-center gap-3 border-t border-[#EAE5D9]/40 mt-4 pt-3 text-xs text-[#6C6C6C]">
              <span className="font-semibold flex items-center gap-1"><Share2 className="w-3.5 h-3.5" /> Partager :</span>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={shareOnWhatsapp}
                  className="px-2.5 py-1 rounded bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={shareOnFacebook}
                  className="px-2.5 py-1 rounded bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  Facebook
                </button>
                <button
                  type="button"
                  onClick={shareOnLinkedin}
                  className="px-2.5 py-1 rounded bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2]/20 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  LinkedIn
                </button>
                <button
                  type="button"
                  onClick={shareOnTwitter}
                  className="px-2.5 py-1 rounded bg-[#2D2D2D]/10 text-[#2D2D2D] hover:bg-[#2D2D2D]/20 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  X
                </button>
                <button
                  type="button"
                  onClick={copyLink}
                  className="px-2.5 py-1 rounded bg-[#FAF8F5] text-[#2D2D2D] hover:bg-[#EAE5D9] border border-[#EAE5D9] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" /> Copier le lien
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EAE5D9]/60 mt-4 pt-2">
              <ReactionSection
                targetType="question"
                targetId={id}
                reactions={q.reactions}
                onReact={handleReact}
                userId={user.id}
              />
              <div className="flex flex-wrap gap-2 text-xs w-full sm:w-auto sm:justify-end">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); reportQ(); }}
                  data-testid="report-question-btn"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#EAE5D9] bg-white px-3 text-xs font-bold text-[#6C6C6C] shadow-sm transition hover:border-[#C84B31]/40 hover:text-[#C84B31]"
                >
                  <Flag className="w-3.5 h-3.5" /> Signaler
                </button>
                {(isAuthor || isAdmin) && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); editQ(); }}
                      data-testid="edit-question-btn"
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#EAE5D9] bg-white px-3 text-xs font-bold text-[#6C6C6C] shadow-sm transition hover:border-[#C84B31]/40 hover:text-[#C84B31]"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Modifier
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteQ(); }}
                      data-testid="delete-question-btn"
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#EAE5D9] bg-white px-3 text-xs font-bold text-[#6C6C6C] shadow-sm transition hover:border-[#C84B31]/40 hover:text-[#C84B31]"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Supprimer
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Answers */}
      <div>
        <h2 className="font-['Manrope'] font-bold text-xl mb-3">
          {q.answers_count} réponse{q.answers_count > 1 ? "s" : ""}
        </h2>
        <div className="space-y-4">
          {(q.answers || []).map((a) => (
            <div
              key={a.id}
              data-testid={`answer-${a.id}`}
              className={`card-flat p-4 ${a.is_accepted ? "border-[#1F4E3D] bg-[#1F4E3D]/5" : ""}`}
            >
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {renderAvatar(a.author_avatar, a.author_name, "w-7 h-7 text-xs")}
                    <div>
                      <div className="text-xs text-[#2D2D2D] font-bold flex items-center gap-1.5 flex-wrap">
                        <span>{a.author_name}</span>
                        {a.author_role === "assistant" && a.author_kyc_status === "approved" && (
                          <span className="inline-flex items-center gap-0.5 bg-[#1F4E3D] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-sm" title="Comptable Vérifié (KYC)">
                            Pro
                          </span>
                        )}
                        <span className="text-[#6C6C6C] font-normal">({roleLabel(a.author_role)})</span>
                      </div>
                      <div className="text-[10px] text-[#6C6C6C]">
                        {new Date(a.created_at).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-[#2D2D2D] whitespace-pre-wrap">{a.body}</div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EAE5D9]/40 mt-3 pt-1">
                    <ReactionSection
                      targetType="answer"
                      targetId={a.id}
                      reactions={a.reactions}
                      onReact={handleReact}
                      userId={user.id}
                    />
                    <div className="flex flex-wrap gap-2 text-xs w-full sm:w-auto sm:justify-end">
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); reportA(a.id); }} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#EAE5D9] bg-white px-3 text-xs font-bold text-[#6C6C6C] shadow-sm transition hover:border-[#C84B31]/40 hover:text-[#C84B31]">
                        <Flag className="w-3.5 h-3.5" /> Signaler
                      </button>
                      {(a.author_id === user.id || isAdmin) && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); editA(a); }}
                            data-testid={`edit-answer-${a.id}`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#EAE5D9] bg-white px-3 text-xs font-bold text-[#6C6C6C] shadow-sm transition hover:border-[#C84B31]/40 hover:text-[#C84B31]"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Modifier
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteA(a.id); }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#EAE5D9] bg-white px-3 text-xs font-bold text-[#6C6C6C] shadow-sm transition hover:border-[#C84B31]/40 hover:text-[#C84B31]"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Supprimer
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Sub-replies (Facebook-style comments) */}
                  <div className="mt-4 pl-2 sm:pl-4 border-l-2 border-[#EAE5D9] space-y-3 bg-[#FAF8F5]/50 p-2 sm:p-2.5 rounded-r-lg min-w-0">
                    {(a.replies || []).map((reply) => (
                      <div key={reply.id} className="text-sm">
                        <div className="flex items-center gap-2">
                          {renderAvatar(reply.author_avatar, reply.author_name, "w-6 h-6 text-[10px]")}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-[#2D2D2D]">{reply.author_name}</span>
                            {reply.author_role === "assistant" && reply.author_kyc_status === "approved" && (
                              <span className="inline-flex items-center gap-0.5 bg-[#1F4E3D] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-sm" title="Comptable Vérifié (KYC)">
                                Pro
                              </span>
                            )}
                            <span className="text-[10px] text-[#6C6C6C]">({roleLabel(reply.author_role)})</span>
                          </div>
                          <span className="text-[9px] text-[#6C6C6C] ml-auto">{new Date(reply.created_at).toLocaleDateString("fr-FR")}</span>
                        </div>
                        <div className="mt-1 text-[#2D2D2D] text-xs whitespace-pre-wrap pl-8">{reply.body}</div>
                        
                        <div className="pl-8">
                          <ReactionSection
                            targetType="subreply"
                            targetId={a.id}
                            subReplyId={reply.id}
                            reactions={reply.reactions}
                            onReact={handleReact}
                            userId={user.id}
                          />
                        </div>
                      </div>
                    ))}

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const text = e.target.replyText.value;
                        if (!text.trim()) return;
                        submitReply(a.id, text);
                        e.target.replyText.value = "";
                      }}
                      className="flex items-center gap-1.5 sm:gap-2 mt-2 pt-2 border-t border-[#EAE5D9]/40 min-w-0"
                    >
                      {renderAvatar(user.avatar_url, user.display_name, "w-6 h-6 text-[10px]")}
                      <input
                        name="replyText"
                        type="text"
                        placeholder="Écrire un commentaire..."
                        className="flex-1 min-w-0 bg-white border border-[#EAE5D9] rounded-full px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#C84B31]"
                      />
                      <button type="submit" className="text-xs text-[#C84B31] font-semibold hover:text-[#A83E28] px-1.5 sm:px-2 py-1 shrink-0">
                        Répondre
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New answer */}
      <form onSubmit={submitAnswer} className="card-flat p-4" data-testid="new-answer-form">
        <div className="font-['Manrope'] font-bold mb-2 flex items-center gap-1">
          <MessageCircle className="w-4 h-4" /> Votre réponse
        </div>
        <Textarea
          rows={5}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Partagez votre expertise..."
          data-testid="answer-input"
        />
        <Button
          type="submit"
          disabled={posting}
          data-testid="submit-answer-btn"
          className="mt-3 bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-full"
        >
          {posting ? "Publication..." : "Publier la réponse"}
        </Button>
      </form>

      <ForumActionModal
        modal={actionModal}
        saving={modalSaving}
        onClose={() => setActionModal(null)}
        onSubmit={submitActionModal}
      />
    </div>
  );
}
