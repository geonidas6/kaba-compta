import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Trash2,
  Eye,
  EyeOff,
  CornerDownRight,
  MessageSquare,
  Clock,
  User,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";

function AdminReactionsDisplay({ reactions }) {
  const activeReactions = Object.entries(reactions || {}).filter(([_, users]) => users.length > 0);
  const totalCount = activeReactions.reduce((acc, [_, users]) => acc + users.length, 0);

  if (totalCount === 0) return null;

  return (
    <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#EAE5D9] px-2 py-0.5 rounded-full text-xs shadow-xs w-fit mt-1">
      <div className="flex gap-1 text-sm">
        {activeReactions.map(([emoji]) => (
          <span key={emoji} title={`${reactions[emoji].length} réaction(s)`}>{emoji}</span>
        ))}
      </div>
      <span className="font-bold text-[#6C6C6C] text-[10px]">{totalCount}</span>
    </div>
  );
}

export default function AdminForumQuestionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAnswers, setLoadingAnswers] = useState(false);

  const loadQuestion = async () => {
    try {
      const r = await api.get(`/admin/forum/questions/${id}`);
      setQuestion(r.data);
    } catch (err) {
      toast.error("Question introuvable");
      navigate("/admin/forum-reports");
    }
  };

  const loadAnswers = async () => {
    setLoadingAnswers(true);
    try {
      const r = await api.get(`/admin/forum/questions/${id}/answers`);
      setAnswers(r.data);
    } catch (err) {
      toast.error("Erreur de chargement des réponses");
    } finally {
      setLoadingAnswers(false);
    }
  };

  const init = async () => {
    setLoading(true);
    await loadQuestion();
    await loadAnswers();
    setLoading(false);
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line
  }, [id]);

  const handleToggleHideQ = async () => {
    try {
      const r = await api.post(`/admin/forum/questions/${id}/toggle-hide`);
      toast.success(r.data.is_hidden ? "Question masquée" : "Question affichée");
      loadQuestion();
    } catch (err) {
      toast.error("Action impossible");
    }
  };

  const handleDeleteQ = async () => {
    if (!window.confirm("Supprimer définitivement cette question et toutes ses réponses ?")) return;
    try {
      await api.delete(`/admin/forum/questions/${id}`);
      toast.success("Question supprimée");
      navigate("/admin/forum-reports");
    } catch (err) {
      toast.error("Action impossible");
    }
  };

  const handleToggleHideA = async (aId) => {
    try {
      const r = await api.post(`/admin/forum/answers/${aId}/toggle-hide`);
      toast.success(r.data.is_hidden ? "Réponse masquée" : "Réponse affichée");
      loadAnswers();
    } catch (err) {
      toast.error("Action impossible");
    }
  };

  const handleDeleteA = async (aId) => {
    if (!window.confirm("Supprimer définitivement cette réponse ?")) return;
    try {
      await api.delete(`/admin/forum/answers/${aId}`);
      toast.success("Réponse supprimée");
      loadAnswers();
    } catch (err) {
      toast.error("Action impossible");
    }
  };

  const handleDeleteReply = async (aId, replyId) => {
    if (!window.confirm("Supprimer définitivement ce commentaire ?")) return;
    try {
      await api.delete(`/admin/forum/answers/${aId}/replies/${replyId}`);
      toast.success("Commentaire supprimé");
      loadAnswers();
    } catch (err) {
      toast.error("Action impossible");
    }
  };

  if (loading) {
    return <div className="p-8 text-[#6C6C6C]">Chargement des détails de la question...</div>;
  }

  if (!question) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4" data-testid="admin-forum-question-detail-page">
      <div>
        <Link
          to="/admin/forum-reports"
          className="inline-flex items-center gap-1 text-sm text-[#1F4E3D] hover:underline font-bold mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Retour à la gestion du forum
        </Link>
        <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Fiche Question</p>
        <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1 flex items-center gap-2">
          Détails de la question
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Content (Left Column) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Question Card */}
          <div className="card-flat p-6 bg-white space-y-4 shadow-sm border border-[#EAE5D9]">
            <div className="flex justify-between items-start gap-4">
              <h2 className="font-['Manrope'] font-extrabold text-xl text-[#2D2D2D]">
                {question.title}
              </h2>
              {question.is_hidden && (
                <span className="shrink-0 text-xs bg-[#C84B31]/10 text-[#C84B31] px-2.5 py-1 rounded-full font-bold">
                  Masqué
                </span>
              )}
            </div>

            <div className="text-sm text-[#2D2D2D] whitespace-pre-wrap leading-relaxed bg-[#FAF8F5] p-4 rounded-xl border border-[#EAE5D9]/50">
              {question.body}
            </div>

            <AdminReactionsDisplay reactions={question.reactions} />

            {question.tags && question.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {question.tags.map((t) => (
                  <span key={t} className="text-xs bg-[#EAE5D9] px-2.5 py-1 rounded-full text-[#2D2D2D]">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Answers Title */}
          <div className="flex items-center justify-between pt-2">
            <h3 className="font-['Manrope'] font-bold text-lg text-[#2D2D2D] flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#1F4E3D]" /> Réponses ({answers.length})
            </h3>
          </div>

          {/* Answers List */}
          {loadingAnswers ? (
            <div className="text-[#6C6C6C]">Chargement des réponses...</div>
          ) : answers.length === 0 ? (
            <div className="card-flat p-8 text-center text-[#6C6C6C] bg-white border border-[#EAE5D9]">
              Aucune réponse rédigée pour le moment.
            </div>
          ) : (
            <div className="space-y-4">
              {answers.map((a) => (
                <div key={a.id} className="card-flat p-5 bg-white space-y-3 shadow-sm border border-[#EAE5D9]">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#1F4E3D]/10 grid place-items-center text-[#1F4E3D]">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#2D2D2D]">
                          {a.author_name}
                        </div>
                        <div className="text-[10px] text-[#6C6C6C] uppercase tracking-wider font-semibold">
                          {a.author_role} · {new Date(a.created_at).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleHideA(a.id)}
                        title={a.is_hidden ? "Afficher" : "Masquer"}
                        className="h-8 w-8 p-0"
                      >
                        {a.is_hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteA(a.id)}
                        title="Supprimer la réponse"
                        className="h-8 w-8 p-0 hover:bg-[#C84B31]/10 hover:text-[#C84B31] border-[#EAE5D9]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm text-[#2D2D2D] whitespace-pre-wrap leading-relaxed">
                    {a.body}
                  </div>

                  <AdminReactionsDisplay reactions={a.reactions} />

                  {a.is_hidden && (
                    <span className="text-[10px] bg-[#C84B31]/10 text-[#C84B31] px-2 py-0.5 rounded font-bold inline-block">
                      Masqué
                    </span>
                  )}

                  {/* Sub-replies (Comments) */}
                  {a.replies && a.replies.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-[#EAE5D9] space-y-3 pt-2 bg-[#FAF8F5]/60 p-3 rounded-lg">
                      <div className="text-[10px] uppercase font-bold text-[#6C6C6C] tracking-widest">
                        Commentaires ({a.replies.length})
                      </div>
                      {a.replies.map((reply) => (
                        <div key={reply.id} className="bg-white p-3 rounded-lg text-xs flex justify-between items-start gap-3 shadow-xs border border-[#EAE5D9]/40">
                          <div className="min-w-0 space-y-1">
                            <div className="text-[10px] text-[#6C6C6C]">
                              Par <strong>{reply.author_name}</strong> ({reply.author_role}) · {new Date(reply.created_at).toLocaleDateString("fr-FR")}
                            </div>
                            <div className="text-xs text-[#2D2D2D] leading-relaxed">{reply.body}</div>
                            <AdminReactionsDisplay reactions={reply.reactions} />
                          </div>
                          <button
                            onClick={() => handleDeleteReply(a.id, reply.id)}
                            title="Supprimer le commentaire"
                            className="text-[#6C6C6C] hover:text-[#C84B31] shrink-0 p-1 rounded hover:bg-[#C84B31]/10 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar / Metadata & Actions (Right Column) */}
        <div className="space-y-6">
          <div className="card-flat p-5 bg-[#FAF8F5] border border-[#EAE5D9] space-y-4">
            <h3 className="font-['Manrope'] font-bold text-base text-[#2D2D2D]">
              Métadonnées & Actions
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#EAE5D9]">
                <span className="text-[#6C6C6C]">Auteur</span>
                <span className="font-bold text-[#2D2D2D]">{question.author_name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#EAE5D9]">
                <span className="text-[#6C6C6C]">Rôle</span>
                <span className="font-bold uppercase text-[#2D2D2D]">{question.author_role}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#EAE5D9]">
                <span className="text-[#6C6C6C]">Créé le</span>
                <span className="font-bold text-[#2D2D2D]">
                  {new Date(question.created_at).toLocaleDateString("fr-FR")} à {new Date(question.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#EAE5D9]">
                <span className="text-[#6C6C6C]">Visibilité</span>
                <span className={`font-bold ${question.is_hidden ? "text-[#C84B31]" : "text-[#1F4E3D]"}`}>
                  {question.is_hidden ? "Masqué" : "Visible"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#EAE5D9]">
                <span className="text-[#6C6C6C]">Réponses</span>
                <span className="font-bold text-[#2D2D2D]">{question.answers_count || 0}</span>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <Button
                onClick={handleToggleHideQ}
                className={`w-full h-10 text-xs font-semibold ${
                  question.is_hidden
                    ? "bg-[#1F4E3D] hover:bg-[#163328] text-white"
                    : "bg-[#ECA869] hover:bg-[#d99151] text-[#2D2D2D]"
                }`}
              >
                {question.is_hidden ? (
                  <>
                    <Eye className="w-4 h-4 mr-1.5" /> Rendre la question publique
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4 mr-1.5" /> Masquer la question
                  </>
                )}
              </Button>
              <Button
                onClick={handleDeleteQ}
                className="w-full h-10 text-xs font-semibold bg-[#C84B31] hover:bg-[#A83E28] text-white"
              >
                <Trash2 className="w-4 h-4 mr-1.5" /> Supprimer la question
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
