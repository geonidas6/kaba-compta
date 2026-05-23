import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Flag,
  Trash2,
  EyeOff,
  Eye,
  X,
  AlertTriangle,
  Search,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "sonner";

const STATUS_TABS = [
  { v: "open", l: "Ouverts" },
  { v: "resolved", l: "Résolus" },
  { v: "all", l: "Tous" },
];

export default function AdminForumReports() {
  const [activeSection, setActiveSection] = useState("reports");

  // Reports state
  const [reports, setReports] = useState([]);
  const [statusF, setStatusF] = useState("open");
  const [loadingReports, setLoadingReports] = useState(true);

  // Questions / Content state
  const [questions, setQuestions] = useState([]);
  const [qSearch, setQSearch] = useState("");
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const r = await api.get("/admin/forum/reports", { params: { status_f: statusF } });
      setReports(r.data);
    } catch (err) {
      toast.error("Erreur de chargement des signalements");
    } finally {
      setLoadingReports(false);
    }
  };

  const loadQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const r = await api.get("/admin/forum/questions", { params: { q: qSearch } });
      setQuestions(r.data);
    } catch (err) {
      toast.error("Erreur de chargement des questions");
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (activeSection === "reports") {
      loadReports();
    } else {
      loadQuestions();
    }
    // eslint-disable-next-line
  }, [statusF, activeSection]);

  const actReport = async (reportId, action) => {
    if (action === "delete" && !window.confirm("Supprimer définitivement ce contenu ?")) return;
    if (action === "hide" && !window.confirm("Masquer ce contenu ?")) return;
    try {
      await api.post(`/admin/forum/reports/${reportId}/resolve`, null, { params: { action } });
      toast.success("Action effectuée");
      loadReports();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  const handleToggleHideQ = async (qId) => {
    try {
      const r = await api.post(`/admin/forum/questions/${qId}/toggle-hide`);
      toast.success(r.data.is_hidden ? "Question masquée" : "Question affichée");
      loadQuestions();
    } catch (err) {
      toast.error("Action impossible");
    }
  };

  const handleDeleteQ = async (qId) => {
    if (!window.confirm("Supprimer définitivement cette question et toutes ses réponses ?")) return;
    try {
      await api.delete(`/admin/forum/questions/${qId}`);
      toast.success("Question supprimée");
      loadQuestions();
    } catch (err) {
      toast.error("Action impossible");
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-forum-reports-page">
      <div>
        <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Modération</p>
        <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1 flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-[#C84B31]" /> Gestion du Forum
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#EAE5D9]">
        <button
          onClick={() => setActiveSection("reports")}
          className={`px-4 py-2 font-['Manrope'] font-bold text-sm -mb-px border-b-2 transition ${
            activeSection === "reports"
              ? "border-[#C84B31] text-[#C84B31]"
              : "border-transparent text-[#6C6C6C] hover:text-[#2D2D2D]"
          }`}
        >
          Signalements ({reports.filter(r => r.status === "open").length} ouverts)
        </button>
        <button
          onClick={() => setActiveSection("all_questions")}
          className={`px-4 py-2 font-['Manrope'] font-bold text-sm -mb-px border-b-2 transition ${
            activeSection === "all_questions"
              ? "border-[#C84B31] text-[#C84B31]"
              : "border-transparent text-[#6C6C6C] hover:text-[#2D2D2D]"
          }`}
        >
          Toutes les Questions
        </button>
      </div>

      {activeSection === "reports" && (
        <div className="space-y-5">
          <div className="flex gap-2">
            {STATUS_TABS.map((s) => (
              <button
                key={s.v}
                onClick={() => setStatusF(s.v)}
                data-testid={`report-status-${s.v}`}
                className={`text-sm px-4 py-2 rounded-full transition ${
                  statusF === s.v
                    ? "bg-[#1F4E3D] text-white"
                    : "bg-white text-[#2D2D2D] border border-[#EAE5D9]"
                }`}
              >
                {s.l}
              </button>
            ))}
          </div>

          {loadingReports && <div className="text-[#6C6C6C]">Chargement...</div>}

          {!loadingReports && reports.length === 0 && (
            <div className="card-flat p-8 text-center">
              <Flag className="w-10 h-10 text-[#6C6C6C] mx-auto" />
              <div className="text-[#6C6C6C] mt-3">Aucun signalement trouvé.</div>
            </div>
          )}

          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="card-flat p-4" data-testid={`report-${r.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-widest text-[#C84B31] font-bold">
                      {r.target_type === "question" ? "Question signalée" : "Réponse signalée"}
                    </div>
                    <div className="text-sm text-[#6C6C6C] mt-1">
                      Par <strong>{r.reporter_name}</strong> · {new Date(r.created_at).toLocaleString("fr-FR")}
                    </div>
                    <div className="mt-2 p-2 rounded bg-[#FAF8F5] border border-[#EAE5D9] text-sm">
                      <strong>Raison :</strong> {r.reason}
                    </div>
                    {r.target ? (
                      <div className="mt-2 p-3 rounded bg-white border border-[#EAE5D9]">
                        {r.target.title && <div className="font-['Manrope'] font-bold">{r.target.title}</div>}
                        <div className="text-sm text-[#2D2D2D]/80 line-clamp-3 mt-1">{r.target.body}</div>
                        {r.target.is_hidden && (
                          <div className="text-xs text-[#C84B31] mt-2 flex items-center gap-1">
                            <EyeOff className="w-3 h-3" /> Contenu masqué
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 p-3 rounded bg-[#C84B31]/5 border border-[#C84B31]/20 text-sm text-[#C84B31] flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Contenu déjà supprimé
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        r.status === "open" ? "bg-[#ECA869]/20 text-[#2D2D2D]" : "bg-[#1F4E3D]/10 text-[#1F4E3D]"
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.action && <div className="text-xs text-[#6C6C6C] mt-1">→ {r.action}</div>}
                  </div>
                </div>

                {r.status === "open" && r.target && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => actReport(r.id, "dismiss")}
                      data-testid={`dismiss-${r.id}`}
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Ignorer
                    </Button>
                    {!r.target.is_hidden && (
                      <Button
                        size="sm"
                        onClick={() => actReport(r.id, "hide")}
                        data-testid={`hide-${r.id}`}
                        className="bg-[#ECA869] hover:bg-[#d99151] text-[#2D2D2D]"
                      >
                        <EyeOff className="w-3.5 h-3.5 mr-1" /> Masquer
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => actReport(r.id, "delete")}
                      data-testid={`delete-${r.id}`}
                      className="bg-[#C84B31] hover:bg-[#A83E28] text-white"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === "all_questions" && (
        <div className="space-y-4">
          <div className="card-flat p-3 flex gap-2 items-center">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-[#6C6C6C] absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={qSearch}
                onChange={(e) => setQSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadQuestions()}
                placeholder="Rechercher une question par titre ou description..."
                className="pl-9"
              />
            </div>
            <Button onClick={loadQuestions} className="bg-[#1F4E3D] hover:bg-[#163328] text-white">
              Rechercher
            </Button>
          </div>

          {loadingQuestions && <div className="text-[#6C6C6C]">Chargement des questions...</div>}

          {!loadingQuestions && questions.length === 0 && (
            <div className="card-flat p-8 text-center text-[#6C6C6C]">
              Aucune question trouvée.
            </div>
          )}

          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="card-flat p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/admin/forum-questions/${q.id}`}
                        className="font-['Manrope'] font-bold text-base text-[#2D2D2D] hover:text-[#1F4E3D] hover:underline"
                      >
                        {q.title}
                      </Link>
                      {q.is_hidden && (
                        <span className="text-[10px] bg-[#C84B31]/10 text-[#C84B31] px-1.5 py-0.5 rounded font-bold">
                          Masqué
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#6C6C6C] mt-1">
                      Par <strong>{q.author_name}</strong> ({q.author_role}) · {new Date(q.created_at).toLocaleDateString("fr-FR")}
                    </div>
                    <div className="text-sm text-[#2D2D2D]/80 mt-2 line-clamp-2">
                      {q.body}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <Link to={`/admin/forum-questions/${q.id}`} className="text-xs">
                        <MessageSquare className="w-3.5 h-3.5 mr-1" /> Gérer & Réponses ({q.answers_count || 0})
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleHideQ(q.id)}
                      className={`text-xs ${q.is_hidden ? "text-[#1F4E3D] hover:text-[#163328]" : "text-[#ECA869] hover:text-[#d99151]"}`}
                    >
                      {q.is_hidden ? <Eye className="w-3.5 h-3.5 mr-1" /> : <EyeOff className="w-3.5 h-3.5 mr-1" />}
                      {q.is_hidden ? "Afficher" : "Masquer"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleDeleteQ(q.id)}
                      className="bg-[#C84B31] hover:bg-[#A83E28] text-white text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
