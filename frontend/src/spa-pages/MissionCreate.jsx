import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Briefcase, ArrowLeft, Lightbulb, ShieldCheck, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";

const MISSION_TYPES = [
  { v: "caisse", l: "Point de caisse" },
  { v: "inventaire", l: "Inventaire stock" },
  { v: "audit", l: "Audit / Rapport" },
  { v: "fiscal", l: "Fiscal / TVA / TPU" },
  { v: "paie", l: "Gestion de la paie" },
  { v: "creation_entreprise", l: "Création d'entreprise" },
  { v: "autre", l: "Autre besoin comptable" },
];

const PRICING_MODES = [
  { v: "fixed", l: "Prix fixe" },
  { v: "max", l: "Prix maximum" },
];

export default function MissionCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "caisse",
    pricing_mode: "fixed",
    budget_min_fcfa: "",
    budget_max_fcfa: "",
    fixed_price_fcfa: "",
    location: "Lomé",
    contract_type: "ponctuelle",
    level: "intermediaire",
    remote_ok: false,
  });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (form.pricing_mode === "fixed") {
        const fixed = form.fixed_price_fcfa ? parseFloat(form.fixed_price_fcfa) : null;
        payload.budget_min_fcfa = fixed;
        payload.budget_max_fcfa = fixed;
      } else if (form.pricing_mode === "max") {
        payload.budget_min_fcfa = null;
        payload.budget_max_fcfa = form.budget_max_fcfa ? parseFloat(form.budget_max_fcfa) : null;
      }
      delete payload.pricing_mode;
      delete payload.fixed_price_fcfa;

      await api.post("/missions", payload);
      toast.success("Votre offre de mission a été publiée avec succès !");
      navigate("/app/missions");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de la publication");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="mission-create-page">
      <div>
        <Link to="/app/missions" className="text-xs text-[#6C6C6C] hover:text-[#2D2D2D] flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour aux missions
        </Link>
        <h1 className="font-['Manrope'] font-extrabold text-3xl mt-2 flex items-center gap-2">
          <Briefcase className="w-8 h-8 text-[#C84B31]" /> Publier un besoin comptable
        </h1>
        <p className="text-sm text-[#6C6C6C] mt-1">
          Décrivez votre besoin pour recevoir des offres personnalisées de comptables et assistants de gestion certifiés.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Form Column */}
        <form onSubmit={submit} className="lg:col-span-2 card-flat p-6 space-y-4 bg-white" data-testid="mission-create-form">
          <div className="space-y-1">
            <Label className="text-sm font-semibold text-[#2D2D2D]">Titre de la mission <span className="text-[#C84B31]">*</span></Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              placeholder="Ex: Tenue de caisse mensuelle et inventaire des stocks"
              className="h-11 border-[#EAE5D9]"
              data-testid="mission-title-input"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold text-[#2D2D2D]">Type de prestation</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="h-11 border-[#EAE5D9]" data-testid="mission-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MISSION_TYPES.map((t) => (
                    <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold text-[#2D2D2D]">Ville / Lieu d'exécution <span className="text-[#C84B31]">*</span></Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
                className="h-11 border-[#EAE5D9]"
                data-testid="mission-location-input"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-semibold text-[#2D2D2D]">Description détaillée du besoin <span className="text-[#C84B31]">*</span></Label>
            <Textarea
              rows={6}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              placeholder="Listez les tâches à accomplir, le volume de pièces comptables mensuel, le logiciel utilisé (Excel, QuickBooks, etc.), et les livrables attendus."
              className="border-[#EAE5D9]"
              data-testid="mission-description-input"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-semibold text-[#2D2D2D]">Mode de prix</Label>
            <Select value={form.pricing_mode} onValueChange={(v) => setForm({ ...form, pricing_mode: v })}>
              <SelectTrigger className="h-11 border-[#EAE5D9]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICING_MODES.map((p) => (
                  <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {(form.pricing_mode === "fixed") && (
              <div className="space-y-1">
                <Label className="text-sm font-semibold text-[#2D2D2D]">
                  Prix fixe (FCFA)
                </Label>
                <Input
                  type="number"
                  value={form.fixed_price_fcfa}
                  onChange={(e) => setForm({
                    ...form,
                    fixed_price_fcfa: e.target.value,
                  })}
                  placeholder="Ex: 12000"
                  className="h-11 border-[#EAE5D9]"
                  data-testid="mission-budget-min-input"
                />
              </div>
            )}

            {(form.pricing_mode === "max") && (
              <div className="space-y-1">
                <Label className="text-sm font-semibold text-[#2D2D2D]">Prix maximum (FCFA)</Label>
                <Input
                  type="number"
                  value={form.budget_max_fcfa}
                  onChange={(e) => setForm({ ...form, budget_max_fcfa: e.target.value })}
                  placeholder="<150.000"
                  className="h-11 border-[#EAE5D9]"
                  data-testid="mission-budget-max-input"
                />
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold text-[#2D2D2D]">Type de contrat <span className="text-[#C84B31]">*</span></Label>
              <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v })}>
                <SelectTrigger className="h-11 border-[#EAE5D9]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ponctuelle">Mission ponctuelle</SelectItem>
                  <SelectItem value="saisonnier">Renfort saisonnier</SelectItem>
                  <SelectItem value="stage">Stage professionnel</SelectItem>
                  <SelectItem value="cdd">Contrat CDD</SelectItem>
                  <SelectItem value="cdi">Contrat CDI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold text-[#2D2D2D]">Niveau d'expérience requis <span className="text-[#C84B31]">*</span></Label>
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                <SelectTrigger className="h-11 border-[#EAE5D9]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Junior (Débutant accepté)</SelectItem>
                  <SelectItem value="intermediaire">Intermédiaire (2-4 ans)</SelectItem>
                  <SelectItem value="senior">Senior (5 ans et plus)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE5D9]">
            <input
              type="checkbox"
              id="remote_ok"
              checked={form.remote_ok}
              onChange={(e) => setForm({ ...form, remote_ok: e.target.checked })}
              className="w-4 h-4 text-[#1F4E3D] rounded border-[#EAE5D9] focus:ring-[#1F4E3D]"
            />
            <label htmlFor="remote_ok" className="text-sm font-medium text-[#2D2D2D] cursor-pointer">
              Cette mission peut s'effectuer à distance (télétravail autorisé)
            </label>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-xl text-base font-bold shadow-md transition"
              data-testid="mission-submit-btn"
            >
              {loading ? "Publication..." : "Publier ma demande de prestation"}
            </Button>
          </div>
          
          <p className="text-xs text-[#6C6C6C] text-center mt-2">
            * Note : Les modalités de paiement et de contrat se discutent directement avec le professionnel, en dehors de la plateforme.
          </p>
        </form>

        {/* Sidebar Help Column */}
        <div className="space-y-4">
          <div className="card-flat p-5 bg-[#1F4E3D]/5 border-[#1F4E3D]/20 space-y-4">
            <div className="flex items-center gap-2 text-[#1F4E3D] font-bold">
              <Lightbulb className="w-5 h-5 text-[#ECA869]" />
              <h3 className="font-['Manrope'] text-base">Conseils de rédaction</h3>
            </div>
            
            <div className="space-y-3.5 text-xs text-[#2D2D2D]">
              <div>
                <h4 className="font-bold text-[#1F4E3D] mb-1">1. Titre clair et précis</h4>
                <p className="text-[#6C6C6C] leading-relaxed">
                  Mentionnez directement le type de travail et la récurrence. <br />
                  <span className="text-[#C84B31]">✓ À privilégier :</span> "Tenue de caisse journalière et bilan mensuel - Boutique" <br />
                  <span className="text-gray-400">✗ À éviter :</span> "Besoin de quelqu'un"
                </p>
              </div>

              <div className="border-t border-[#EAE5D9] pt-3">
                <h4 className="font-bold text-[#1F4E3D] mb-1">2. Détaillez vos attentes</h4>
                <p className="text-[#6C6C6C] leading-relaxed">
                  Indiquez les volumes : nombre de factures à saisir par mois, le type d'activité (commerce, agence, artisan) et le logiciel utilisé (QuickBooks, Excel, etc.).
                </p>
              </div>

              <div className="border-t border-[#EAE5D9] pt-3">
                <h4 className="font-bold text-[#1F4E3D] mb-1">3. Estimez le bon niveau</h4>
                <p className="text-[#6C6C6C] leading-relaxed">
                  <strong>Junior</strong> est parfait pour la saisie de pièces et le pointage simple.<br />
                  <strong>Intermédiaire</strong> pour les déclarations fiscales (TVA, TPU) ou sociales (CNSS).<br />
                  <strong>Senior</strong> pour les bilans complexes, audits ou conseils fiscaux stratégiques.
                </p>
              </div>
            </div>
          </div>

          <div className="card-flat p-5 bg-white space-y-3">
            <div className="flex items-center gap-2 text-[#2D2D2D] font-bold">
              <ShieldCheck className="w-5 h-5 text-[#1F4E3D]" />
              <h3 className="font-['Manrope'] text-sm">Transparence & Sécurité</h3>
            </div>
            <p className="text-xs text-[#6C6C6C] leading-relaxed">
              Kaba-Compta est une plateforme de mise en relation directe. Nous ne prenons aucune commission sur les transactions. 
              Pour votre sécurité, nous vous invitons à valider l'expérience du professionnel (diplômes, références) avant de lui confier vos accès comptables ou bancaires.
            </p>
          </div>

          <div className="card-flat p-5 bg-white space-y-3">
            <div className="flex items-center gap-2 text-[#2D2D2D] font-bold">
              <HelpCircle className="w-5 h-5 text-[#6C6C6C]" />
              <h3 className="font-['Manrope'] text-sm">Besoin d'aide ?</h3>
            </div>
            <p className="text-xs text-[#6C6C6C] leading-relaxed">
              Consultez notre forum d'entraide ou contactez le support pour vous aider à formaliser votre besoin de comptabilité.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
