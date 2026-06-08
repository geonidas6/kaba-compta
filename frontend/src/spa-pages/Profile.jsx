import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Briefcase, Calendar, Camera, Eye, FileText, KeyRound, Languages, Plus, ShieldCheck, Smartphone, Star, Trash2, Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const emptyExperience = { title: "", company: "", start_date: "", end_date: "", current: false, description: "" };
const emptyFormation = { school: "", degree: "", start_date: "", end_date: "", current: false, description: "" };
const emptyReference = { name: "", role: "", contact: "", relation: "Ancien employeur" };
const emptyLanguage = { name: "", level: "Intermédiaire" };

const kycLabel = {
  approved: "Approuvé",
  pending: "En attente de validation",
  incomplete: "Dossier incomplet",
  rejected: "Rejeté",
  not_required: "Non requis",
};

const splitList = (value) => value.split(",").map((x) => x.trim()).filter(Boolean);
const joinList = (value = []) => value.join(", ");
const normalizeLanguages = (value = []) => value.map((lang) => typeof lang === "string" ? { name: lang, level: "Intermédiaire" } : lang);

function SectionTitle({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-5 h-5 text-[#1F4E3D]" />
      <h2 className="font-['Manrope'] font-bold">{title}</h2>
    </div>
  );
}

function PeriodFields({ item, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <Label>Date de début</Label>
        <Input type="month" value={item.start_date || ""} onChange={(e) => onChange({ ...item, start_date: e.target.value })} />
      </div>
      <div>
        <Label>Date de fin</Label>
        <Input type="month" value={item.end_date || ""} disabled={item.current} onChange={(e) => onChange({ ...item, end_date: e.target.value })} />
      </div>
      <label className="col-span-2 flex items-center gap-2 text-sm font-semibold text-[#2D2D2D]">
        <input type="checkbox" checked={Boolean(item.current)} onChange={(e) => onChange({ ...item, current: e.target.checked, end_date: e.target.checked ? "" : item.end_date })} />
        En cours
      </label>
    </div>
  );
}

function SecuritySection({ user, refresh }) {
  const [setup, setSetup] = useState(null);
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);

  const updateWhatsappOtp = async (enabled) => {
    setLoading(true);
    try {
      await api.put("/auth/security", { whatsapp_login_otp_enabled: enabled });
      await refresh();
      toast.success(enabled ? "OTP WhatsApp activé" : "OTP WhatsApp désactivé");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Impossible de modifier ce réglage");
    } finally {
      setLoading(false);
    }
  };

  const startTotpSetup = async () => {
    setLoading(true);
    try {
      const r = await api.post("/auth/2fa/totp/setup");
      setSetup(r.data);
      setTotpCode("");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Configuration impossible");
    } finally {
      setLoading(false);
    }
  };

  const enableTotp = async () => {
    setLoading(true);
    try {
      await api.post("/auth/2fa/totp/enable", { code: totpCode });
      await refresh();
      setSetup(null);
      setTotpCode("");
      toast.success("Application d'authentification activée");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Code incorrect");
    } finally {
      setLoading(false);
    }
  };

  const disableTotp = async () => {
    setLoading(true);
    try {
      await api.post("/auth/2fa/totp/disable");
      await refresh();
      setSetup(null);
      toast.success("Application d'authentification désactivée");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Désactivation impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-flat p-4" data-testid="profile-security-section">
      <SectionTitle icon={ShieldCheck} title="Sécurité de connexion" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#EAE5D9] bg-white p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-[#1F4E3D] mt-0.5" />
            <div className="flex-1">
              <div className="font-['Manrope'] font-bold">OTP par WhatsApp</div>
              <p className="text-sm text-[#6C6C6C]">Recevoir un code WhatsApp à chaque connexion.</p>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${user.whatsapp_login_otp_enabled ? "bg-[#1F4E3D] text-white" : "bg-[#EAE5D9] text-[#6C6C6C]"}`}>
              {user.whatsapp_login_otp_enabled ? "Activé" : "Désactivé"}
            </span>
          </div>
          <Button type="button" disabled={loading} variant={user.whatsapp_login_otp_enabled ? "outline" : "default"} onClick={() => updateWhatsappOtp(!user.whatsapp_login_otp_enabled)} className={user.whatsapp_login_otp_enabled ? "rounded-full" : "rounded-full bg-[#1F4E3D] hover:bg-[#163328] text-white"}>
            {user.whatsapp_login_otp_enabled ? "Désactiver" : "Activer"}
          </Button>
        </div>

        <div className="rounded-xl border border-[#EAE5D9] bg-white p-4 space-y-3">
          <div className="flex items-start gap-3">
            <KeyRound className="w-5 h-5 text-[#1F4E3D] mt-0.5" />
            <div className="flex-1">
              <div className="font-['Manrope'] font-bold">Application d'authentification</div>
              <p className="text-sm text-[#6C6C6C]">Utiliser Google Authenticator, Microsoft Authenticator ou une application compatible.</p>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${user.totp_enabled ? "bg-[#1F4E3D] text-white" : "bg-[#EAE5D9] text-[#6C6C6C]"}`}>
              {user.totp_enabled ? "Activée" : "Désactivée"}
            </span>
          </div>

          {setup && !user.totp_enabled && (
            <div className="rounded-xl bg-[#FAF8F5] border border-[#EAE5D9] p-3 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <img src={setup.qr_data_url} alt="QR code application d'authentification" className="w-36 h-36 rounded-lg border border-[#EAE5D9] bg-white" />
                <div className="text-sm text-[#6C6C6C]">
                  <p>Scannez ce QR code avec votre application, puis saisissez le code généré.</p>
                  <p className="mt-2 font-mono text-xs break-all bg-white rounded-lg border border-[#EAE5D9] p-2">{setup.secret}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="Code à 6 chiffres" className="h-11 font-mono tracking-widest" />
                <Button type="button" disabled={loading || totpCode.length < 6} onClick={enableTotp} className="bg-[#1F4E3D] hover:bg-[#163328] text-white rounded-full">Valider</Button>
              </div>
            </div>
          )}

          {user.totp_enabled ? (
            <Button type="button" disabled={loading} variant="outline" onClick={disableTotp} className="rounded-full">Désactiver</Button>
          ) : (
            <Button type="button" disabled={loading} onClick={startTotpSetup} className="rounded-full bg-[#1F4E3D] hover:bg-[#163328] text-white">Configurer</Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({
    display_name: user?.display_name || "",
    shop_name: user?.shop_name || "",
    city: user?.city || "",
    bio: user?.bio || "",
    avatar_url: user?.avatar_url || "",
    education_level: user?.education_level || "Licence",
    skills: joinList(user?.skills || []),
    languages: normalizeLanguages(user?.languages || []),
    experiences: user?.experiences || [],
    formations: user?.formations || [],
    references: user?.references || [],
  });
  const [reviews, setReviews] = useState([]);
  const [docs, setDocs] = useState([]);
  const [docType, setDocType] = useState("id_card");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    api.get(`/reviews/user/${user.id}`).then((r) => setReviews(r.data));
    if (user.role === "assistant") api.get("/kyc/my").then((r) => setDocs(r.data));
  }, [user.id, user.role]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      display_name: user?.display_name || "",
      shop_name: user?.shop_name || "",
      city: user?.city || "",
      bio: user?.bio || "",
      avatar_url: user?.avatar_url || "",
      education_level: user?.education_level || "Licence",
      skills: joinList(user?.skills || []),
      languages: normalizeLanguages(user?.languages || []),
      experiences: user?.experiences || [],
      formations: user?.formations || [],
      references: user?.references || [],
    }));
  }, [user]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/profile", {
        ...form,
        skills: splitList(form.skills),
        languages: form.languages.filter((lang) => lang.name?.trim()).map((lang) => ({ name: lang.name.trim(), level: lang.level || "Intermédiaire" })),
      });
      await refresh();
      toast.success("Profil mis à jour");
    } finally { setSaving(false); }
  };

  const uploadAvatar = async (e) => {
    const img = e.target.files?.[0];
    if (!img) return;
    const fd = new FormData();
    fd.append("file", img);
    try {
      toast.loading("Téléchargement de l'image...", { id: "avatar-upload" });
      const res = await api.post("/profile/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((prev) => ({ ...prev, avatar_url: res.data.avatar_url }));
      await refresh();
      toast.success("Photo de profil mise à jour", { id: "avatar-upload" });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur de téléversement", { id: "avatar-upload" });
    }
  };

  const uploadKyc = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Sélectionnez un fichier");
    if (docType !== "diploma" && !expiryDate) return toast.error("La date d'expiration est obligatoire");
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("doc_type", docType);
    if (docType !== "diploma" && expiryDate) fd.append("expiry_date", expiryDate);
    try {
      await api.post("/kyc/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Document envoyé. Le dossier passe en attente quand identité + diplôme sont fournis.");
      setFile(null);
      setExpiryDate("");
      const r = await api.get("/kyc/my");
      setDocs(r.data);
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally { setUploading(false); }
  };

  const updateList = (key, index, value) => setForm((prev) => ({
    ...prev,
    [key]: prev[key].map((item, i) => (i === index ? value : item)),
  }));
  const addItem = (key, value) => setForm((prev) => ({ ...prev, [key]: [...prev[key], value] }));
  const removeItem = (key, index) => setForm((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));

  const hasIdentity = docs.some((d) => ["id_card", "passport"].includes(d.doc_type));
  const hasDiploma = docs.some((d) => d.doc_type === "diploma");

  return (
    <div className="space-y-4" data-testid="profile-page">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Mon compte</p>
          <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1 flex items-center gap-2">
            <User className="w-7 h-7 text-[#C84B31]" /> Profil
          </h1>
        </div>
        <Link to={`/u/${user.public_slug || user.id}`}>
          <Button variant="outline" className="rounded-full border-[#1F4E3D] text-[#1F4E3D]">
            <Eye className="w-4 h-4 mr-1" /> Prévisualiser
          </Button>
        </Link>
      </div>

      <form onSubmit={save} className="space-y-4" data-testid="profile-form">
        <div className="card-flat p-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative group shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[#1F4E3D] focus:ring-offset-2"
              aria-label="Changer la photo de profil"
              title="Changer la photo de profil"
            >
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="Profil" className="w-14 h-14 rounded-full object-cover border border-[#EAE5D9]" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#C84B31] text-white grid place-items-center font-['Manrope'] font-bold text-xl">
                  {form.display_name?.[0]?.toUpperCase() || user?.display_name?.[0]?.toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#1F4E3D] text-white border-2 border-white shadow grid place-items-center transition group-hover:bg-[#C84B31] group-focus:bg-[#C84B31]">
                <Camera className="w-3.5 h-3.5" />
              </span>
            </button>
            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} className="hidden" data-testid="profile-avatar-upload" />
            <div>
              <div className="font-['Manrope'] font-bold text-lg">{user?.display_name}</div>
              <div className="text-xs text-[#6C6C6C]">{user?.phone} · {user?.role === "merchant" ? "Commerçant" : "Comptable"}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Nom affiché</Label>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="h-11" data-testid="profile-name-input" />
            </div>
            {user.role === "merchant" && (
              <div>
                <Label>Boutique</Label>
                <Input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} className="h-11" data-testid="profile-shop-input" />
              </div>
            )}
            <div>
              <Label>Ville</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="h-11" data-testid="profile-city-input" />
            </div>
            {user.role === "assistant" && (
              <div>
                <Label>Niveau d'étude</Label>
                <select
                  value={form.education_level || "Licence"}
                  onChange={(e) => setForm({ ...form, education_level: e.target.value })}
                  className="h-11 w-full rounded-md border border-[#EAE5D9] bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C84B31]/20"
                  data-testid="profile-education-level-input"
                >
                  <option value="BTS">BTS</option>
                  <option value="Licence">Licence</option>
                  <option value="Master">Master</option>
                  <option value="Doctorat">Doctorat</option>
                </select>
              </div>
            )}
            <div>
              <Label>{user.role === "assistant" ? "Résumé professionnel" : "Description"}</Label>
              <Textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Présentez votre parcours, votre méthode de travail et les services que vous maîtrisez." data-testid="profile-bio-input" />
            </div>
          </div>
        </div>

        {user.role === "assistant" && (
          <>
            <div className="card-flat p-4">
              <SectionTitle icon={Award} title="Compétences" />
              <Label>Liste de compétences</Label>
              <Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="Ex: TVA, paie, tenue de caisse, Excel" />
            </div>

            <div className="card-flat p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <SectionTitle icon={Languages} title="Langues" />
                <Button type="button" variant="outline" className="rounded-full" onClick={() => addItem("languages", emptyLanguage)}><Plus className="w-4 h-4 mr-1" /> Ajouter</Button>
              </div>
              <div className="space-y-3">
                {form.languages.length === 0 && <p className="text-sm text-[#6C6C6C]">Aucune langue ajoutée.</p>}
                {form.languages.map((lang, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <Input placeholder="Langue" value={lang.name || ""} onChange={(e) => updateList("languages", i, { ...lang, name: e.target.value })} />
                    <select value={lang.level || "Intermédiaire"} onChange={(e) => updateList("languages", i, { ...lang, level: e.target.value })} className="h-10 w-full rounded-md border border-[#EAE5D9] bg-white px-3 text-sm">
                      <option>Débutant</option>
                      <option>Intermédiaire</option>
                      <option>Avancé</option>
                      <option>Courant</option>
                      <option>Langue maternelle</option>
                    </select>
                    <button type="button" onClick={() => removeItem("languages", i)} className="h-10 w-10 grid place-items-center rounded-lg text-[#D32F2F] hover:bg-[#D32F2F]/10"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-flat p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <SectionTitle icon={Briefcase} title="Expériences" />
                <Button type="button" variant="outline" className="rounded-full" onClick={() => addItem("experiences", emptyExperience)}><Plus className="w-4 h-4 mr-1" /> Ajouter</Button>
              </div>
              <div className="space-y-3">
                {form.experiences.length === 0 && <p className="text-sm text-[#6C6C6C]">Aucune expérience ajoutée.</p>}
                {form.experiences.map((exp, i) => (
                  <div key={i} className="p-3 rounded-xl border border-[#EAE5D9] bg-white space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Poste" value={exp.title || ""} onChange={(e) => updateList("experiences", i, { ...exp, title: e.target.value })} />
                      <Input placeholder="Entreprise" value={exp.company || ""} onChange={(e) => updateList("experiences", i, { ...exp, company: e.target.value })} />
                    </div>
                    <PeriodFields item={exp} onChange={(v) => updateList("experiences", i, v)} />
                    <Textarea rows={2} placeholder="Missions réalisées" value={exp.description || ""} onChange={(e) => updateList("experiences", i, { ...exp, description: e.target.value })} />
                    <Button type="button" variant="ghost" className="text-[#D32F2F]" onClick={() => removeItem("experiences", i)}><Trash2 className="w-4 h-4 mr-1" /> Retirer</Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-flat p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <SectionTitle icon={Calendar} title="Formations" />
                <Button type="button" variant="outline" className="rounded-full" onClick={() => addItem("formations", emptyFormation)}><Plus className="w-4 h-4 mr-1" /> Ajouter</Button>
              </div>
              <div className="space-y-3">
                {form.formations.length === 0 && <p className="text-sm text-[#6C6C6C]">Aucune formation ajoutée.</p>}
                {form.formations.map((edu, i) => (
                  <div key={i} className="p-3 rounded-xl border border-[#EAE5D9] bg-white space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Diplôme / certificat" value={edu.degree || ""} onChange={(e) => updateList("formations", i, { ...edu, degree: e.target.value })} />
                      <Input placeholder="École / centre" value={edu.school || ""} onChange={(e) => updateList("formations", i, { ...edu, school: e.target.value })} />
                    </div>
                    <PeriodFields item={edu} onChange={(v) => updateList("formations", i, v)} />
                    <Textarea rows={2} placeholder="Détails utiles" value={edu.description || ""} onChange={(e) => updateList("formations", i, { ...edu, description: e.target.value })} />
                    <Button type="button" variant="ghost" className="text-[#D32F2F]" onClick={() => removeItem("formations", i)}><Trash2 className="w-4 h-4 mr-1" /> Retirer</Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-flat p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <SectionTitle icon={User} title="Références" />
                <Button type="button" variant="outline" className="rounded-full" onClick={() => addItem("references", emptyReference)}><Plus className="w-4 h-4 mr-1" /> Ajouter</Button>
              </div>
              <div className="space-y-3">
                {form.references.length === 0 && <p className="text-sm text-[#6C6C6C]">Aucune référence ajoutée.</p>}
                {form.references.map((ref, i) => (
                  <div key={i} className="p-3 rounded-xl border border-[#EAE5D9] bg-white space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Nom" value={ref.name || ""} onChange={(e) => updateList("references", i, { ...ref, name: e.target.value })} />
                      <Input placeholder="Fonction" value={ref.role || ""} onChange={(e) => updateList("references", i, { ...ref, role: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Contact" value={ref.contact || ""} onChange={(e) => updateList("references", i, { ...ref, contact: e.target.value })} />
                      <select value={ref.relation || "Ancien employeur"} onChange={(e) => updateList("references", i, { ...ref, relation: e.target.value })} className="h-10 w-full rounded-md border border-[#EAE5D9] bg-white px-3 text-sm">
                        <option>Ancien employeur</option>
                        <option>Client</option>
                        <option>Collègue</option>
                        <option>Responsable de formation</option>
                        <option>Partenaire</option>
                      </select>
                    </div>
                    <Button type="button" variant="ghost" className="text-[#D32F2F]" onClick={() => removeItem("references", i)}><Trash2 className="w-4 h-4 mr-1" /> Retirer</Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Button type="submit" disabled={saving} data-testid="profile-save-btn" className="bg-[#1F4E3D] hover:bg-[#163328] text-white rounded-full">
          {saving ? "Enregistrement..." : "Enregistrer le profil CV"}
        </Button>
      </form>

      <SecuritySection user={user} refresh={refresh} />

      {user.role === "assistant" && (
        <div className="card-flat p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-[#1F4E3D]" />
            <h2 className="font-['Manrope'] font-bold">Vérification KYC</h2>
            <span className="ml-auto text-xs text-[#6C6C6C]">Statut : {kycLabel[user.kyc_status] || user.kyc_status}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold mb-3">
            <span className={`px-2 py-1 rounded-full ${hasIdentity ? "bg-[#1F4E3D] text-white" : "bg-[#EAE5D9] text-[#6C6C6C]"}`}>Pièce d'identité</span>
            <span className={`px-2 py-1 rounded-full ${hasDiploma ? "bg-[#1F4E3D] text-white" : "bg-[#EAE5D9] text-[#6C6C6C]"}`}>Diplôme</span>
          </div>
          <p className="text-sm text-[#6C6C6C] mb-3">
            Téléversez une pièce d'identité et un diplôme. Quand les deux documents sont fournis, le dossier passe en attente de validation admin.
          </p>
          <form onSubmit={uploadKyc} className="space-y-3" data-testid="kyc-form">
            <div className="space-y-1">
              <Label className="text-xs text-[#6C6C6C]">Type de document</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-11" data-testid="kyc-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="id_card">Carte d'identité</SelectItem>
                  <SelectItem value="passport">Passeport</SelectItem>
                  <SelectItem value="diploma">Diplôme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {docType !== "diploma" && (
              <div className="space-y-1">
                <Label className="text-xs text-[#6C6C6C]">Date d'expiration du document</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="h-11 bg-white" required data-testid="kyc-expiry-input" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-[#6C6C6C]">Fichier</Label>
              <Input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setFile(e.target.files?.[0])} data-testid="kyc-file-input" />
            </div>
            <Button type="submit" disabled={uploading} data-testid="kyc-upload-btn" className="bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-full">
              <Upload className="w-4 h-4 mr-1" /> {uploading ? "Envoi..." : "Téléverser"}
            </Button>
          </form>
          {docs.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-[#EAE5D9] pt-3">
              {docs.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-2 text-sm" data-testid={`kyc-doc-${d.id}`}>
                  <FileText className="w-4 h-4 text-[#6C6C6C]" />
                  <span className="font-semibold">{d.doc_type === "id_card" ? "Carte d'identité" : d.doc_type === "passport" ? "Passeport" : "Diplôme"}</span>
                  {d.expiry_date && <span className="text-xs px-2 py-0.5 rounded-full bg-[#C84B31]/10 text-[#C84B31] font-bold">Expire le : {new Date(d.expiry_date).toLocaleDateString("fr-FR")}</span>}
                  <span className="text-xs text-[#6C6C6C]">· {d.filename} ({Math.round(d.size / 1024)} Ko)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card-flat p-4">
        <h2 className="font-['Manrope'] font-bold mb-2">Avis reçus</h2>
        {reviews.length === 0 ? (
          <div className="text-sm text-[#6C6C6C]">Aucun avis pour le moment.</div>
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              <div key={r.id} className="border-t border-[#EAE5D9] pt-2 first:border-0 first:pt-0">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`w-3.5 h-3.5 ${n <= r.stars ? "fill-[#ECA869] text-[#ECA869]" : "text-[#EAE5D9]"}`} />)}
                  <span className="text-xs text-[#6C6C6C] ml-1">par {r.from_user_name}</span>
                </div>
                {r.comment && <div className="text-sm mt-1">{r.comment}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
