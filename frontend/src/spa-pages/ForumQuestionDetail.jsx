import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowUp, MessageCircle, Check, Flag, Trash2, Share2, Copy } from "lucide-react";
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
  const myReact = Object.keys(reactions || {}).find(emoji => (reactions[emoji] || []).includes(userId));

  const handleEmojiClick = (emoji) => {
    onReact(targetType, targetId, subReplyId, emoji);
    setShowPicker(false);
  };

  return (
    <div className="relative flex items-center gap-2 mt-2">
      {totalCount > 0 && (
        <div className="flex items-center gap-1.5 bg-white border border-[#EAE5D9] px-2 py-0.5 rounded-full text-xs shadow-sm">
          <div className="flex gap-1 text-sm">
            {activeReactions.map(([emoji]) => (
              <span key={emoji}>{emoji}</span>
            ))}
          </div>
          <span className="font-bold text-[#6C6C6C] text-[10px]">{totalCount}</span>
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => handleEmojiClick(myReact || "👍")}
          onMouseEnter={() => setShowPicker(true)}
          className={`px-2 py-1 rounded-full hover:bg-[#FAF8F5] text-xs font-semibold flex items-center gap-1.5 transition ${
            myReact ? "text-[#C84B31] bg-[#C84B31]/5" : "text-[#6C6C6C]"
          }`}
        >
          <span className="text-base">{myReact || "👍"}</span>
          <span>{myReact ? "Réagi" : "Réagir"}</span>
        </button>

        {showPicker && (
          <div
            onMouseLeave={() => setShowPicker(false)}
            className="absolute bottom-full left-0 mb-1.5 bg-white border border-[#EAE5D9] shadow-lg rounded-full px-3 py-2 flex items-center gap-3 z-40 animate-in fade-in zoom-in-95 duration-100"
          >
            {emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className="hover:scale-130 transition text-2xl"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
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

  const voteQ = async () => {
    await api.post(`/forum/questions/${id}/vote`);
    load();
  };

  const reportQ = async () => {
    const reason = window.prompt("Pourquoi signaler cette question ?");
    if (!reason) return;
    await api.post(`/forum/questions/${id}/report`, { reason });
    toast.success("Signalement transmis aux modérateurs");
  };

  const deleteQ = async () => {
    if (!window.confirm("Supprimer la question (et toutes les réponses) ?")) return;
    await api.delete(`/forum/questions/${id}`);
    toast.success("Supprimé");
    navigate("/app/forum");
  };

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

  const voteA = async (aid) => {
    await api.post(`/forum/answers/${aid}/vote`);
    load();
  };

  const acceptA = async (aid) => {
    await api.post(`/forum/answers/${aid}/accept`);
    toast.success("Réponse acceptée");
    load();
  };

  const reportA = async (aid) => {
    const reason = window.prompt("Pourquoi signaler cette réponse ?");
    if (!reason) return;
    await api.post(`/forum/answers/${aid}/report`, { reason });
    toast.success("Signalement transmis");
  };

  const deleteA = async (aid) => {
    if (!window.confirm("Supprimer cette réponse ?")) return;
    await api.delete(`/forum/answers/${aid}`);
    load();
  };

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
      toast.error("Erreur de réaction");
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
          <div className="text-center min-w-[48px]">
            <button
              onClick={voteQ}
              data-testid="vote-question-btn"
              className={`flex flex-col items-center transition ${q.user_vote ? "text-[#C84B31]" : "text-[#1F4E3D] hover:text-[#C84B31]"}`}
            >
              <ArrowUp className="w-6 h-6" />
              <div className="font-['Manrope'] font-extrabold text-xl">{q.votes}</div>
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              {renderAvatar(q.author_avatar, q.author_name)}
              <div>
                <h1 className="font-['Manrope'] font-extrabold text-2xl leading-tight">{q.title}</h1>
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

            <div className="flex items-center justify-between border-t border-[#EAE5D9]/60 mt-4 pt-2">
              <ReactionSection
                targetType="question"
                targetId={id}
                reactions={q.reactions}
                onReact={handleReact}
                userId={user.id}
              />
              <div className="flex gap-2 text-xs">
                <button
                  onClick={reportQ}
                  data-testid="report-question-btn"
                  className="text-[#6C6C6C] hover:text-[#C84B31] flex items-center gap-1"
                >
                  <Flag className="w-3.5 h-3.5" /> Signaler
                </button>
                {(isAuthor || isAdmin) && (
                  <button
                    onClick={deleteQ}
                    data-testid="delete-question-btn"
                    className="text-[#6C6C6C] hover:text-[#C84B31] flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer
                  </button>
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
                <div className="text-center min-w-[40px]">
                  <button onClick={() => voteA(a.id)} data-testid={`vote-answer-${a.id}`} className="text-[#1F4E3D] hover:text-[#C84B31]">
                    <ArrowUp className="w-5 h-5 mx-auto" />
                    <div className="font-['Manrope'] font-bold">{a.votes}</div>
                  </button>
                  {a.is_accepted && (
                    <div className="mt-2 text-[#1F4E3D]" title="Réponse acceptée">
                      <Check className="w-5 h-5 mx-auto" />
                    </div>
                  )}
                </div>
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

                  <div className="flex items-center justify-between border-t border-[#EAE5D9]/40 mt-3 pt-1">
                    <ReactionSection
                      targetType="answer"
                      targetId={a.id}
                      reactions={a.reactions}
                      onReact={handleReact}
                      userId={user.id}
                    />
                    <div className="flex gap-3 text-xs">
                      {isAuthor && !a.is_accepted && (
                        <button
                          onClick={() => acceptA(a.id)}
                          data-testid={`accept-answer-${a.id}`}
                          className="text-[#1F4E3D] hover:text-[#163328] flex items-center gap-1 font-semibold"
                        >
                          <Check className="w-3.5 h-3.5" /> Accepter
                        </button>
                      )}
                      <button onClick={() => reportA(a.id)} className="text-[#6C6C6C] hover:text-[#C84B31] flex items-center gap-1">
                        <Flag className="w-3.5 h-3.5" /> Signaler
                      </button>
                      {(a.author_id === user.id || isAdmin) && (
                        <button
                          onClick={() => deleteA(a.id)}
                          className="text-[#6C6C6C] hover:text-[#C84B31] flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Supprimer
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sub-replies (Facebook-style comments) */}
                  <div className="mt-4 pl-4 border-l-2 border-[#EAE5D9] space-y-3 bg-[#FAF8F5]/50 p-2.5 rounded-r-lg">
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
                      className="flex items-center gap-2 mt-2 pt-2 border-t border-[#EAE5D9]/40"
                    >
                      {renderAvatar(user.avatar_url, user.display_name, "w-6 h-6 text-[10px]")}
                      <input
                        name="replyText"
                        type="text"
                        placeholder="Écrire un commentaire..."
                        className="flex-1 bg-white border border-[#EAE5D9] rounded-full px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#C84B31]"
                      />
                      <button type="submit" className="text-xs text-[#C84B31] font-semibold hover:text-[#A83E28] px-2 py-1">
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
    </div>
  );
}
