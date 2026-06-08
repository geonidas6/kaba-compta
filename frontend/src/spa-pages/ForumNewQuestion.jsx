import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function ForumNewQuestion() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const r = await api.post("/forum/questions", { title, body, tags });
      toast.success("Question publiée");
      navigate(`/app/forum/${r.data.slug || r.data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl" data-testid="forum-new-page">
      <Link to="/app/forum" className="text-sm text-[#6C6C6C]" data-testid="back-to-forum">← Retour au forum</Link>
      <h1 className="font-['Manrope'] font-extrabold text-3xl">Poser une question</h1>
      <p className="text-sm text-[#6C6C6C]">
        Soyez précis. Décrivez le contexte, ce que vous avez essayé et ce que vous cherchez.
      </p>

      <form onSubmit={submit} className="card-flat p-5 space-y-4" data-testid="question-form">
        <div>
          <Label>Titre clair <span className="text-[#C84B31]">*</span></Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={5}
            className="h-11"
            data-testid="question-title-input"
            placeholder="Ex : Comment déclarer la TVA pour une petite boutique ?"
          />
        </div>
        <div>
          <Label>Détails de votre question <span className="text-[#C84B31]">*</span></Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            minLength={10}
            rows={8}
            data-testid="question-body-input"
            placeholder="Décrivez votre situation en détail..."
          />
        </div>
        <div>
          <Label>Tags (séparés par virgule, max 6)</Label>
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="h-11"
            data-testid="question-tags-input"
            placeholder="tva, comptabilité, débutant"
          />
        </div>
        <Button
          type="submit"
          disabled={saving}
          data-testid="question-submit-btn"
          className="bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-full"
        >
          {saving ? "Publication..." : "Publier la question"}
        </Button>
      </form>
    </div>
  );
}
