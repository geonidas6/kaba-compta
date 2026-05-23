import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, User, Star, Wallet, Briefcase, Receipt, Package, HandCoins,
  FileText, Eye, LogIn, ShieldCheck, Crown, Phone, MapPin, Ban, CheckCircle2,
} from "lucide-react";
import { api, fmtFCFA, API } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_LABELS = {
  open: "Ouverte", assigned: "Attribuée", in_progress: "En cours",
  completed: "Terminée", cancelled: "Annulée",
};

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { startImpersonation } = useAuth();
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    phone: "",
    city: "",
    shop_name: "",
    role: "merchant",
  });

  const load = async () => {
    const r = await api.get(`/admin/users/${id}/full`);
    setData(r.data);
    const u = r.data.user;
    setForm({
      display_name: u.display_name || "",
      phone: u.phone || "",
      city: u.city || "",
      shop_name: u.shop_name || "",
      role: u.role || "merchant",
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/admin/users/${id}`, {
        display_name: form.display_name,
        phone: form.phone,
        city: form.city,
        shop_name: form.role === "merchant" ? form.shop_name : "",
        role: form.role,
      });
      toast.success("Utilisateur mis à jour avec succès");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (!data) return <div className="text-[#6C6C6C]">Chargement...</div>;
  const { user: u, stats } = data;

  const impersonate = async () => {
    try {
      const r = await api.post(`/admin/users/${u.id}/impersonate`);
      startImpersonation(r.data.token, r.data.user);
      toast.success(`Connecté en tant que ${u.display_name}`);
      navigate(u.role === "assistant" ? "/app/assistant" : "/app/dashboard");
    } catch (err) { toast.error(err?.response?.data?.detail || "Erreur"); }
  };

  const toggleBan = async () => {
    await api.put(`/admin/users/${u.id}`, { banned: !u.banned });
    toast.success(u.banned ? "Débanni" : "Suspendu");
    load();
  };
  const togglePremium = async () => {
    await api.put(`/admin/users/${u.id}`, { is_premium: !u.is_premium });
    load();
  };

  const decideKyc = async (decision) => {
    await api.post(`/admin/kyc/${u.id}/decision?decision=${decision}`);
    toast.success(decision === "approve" ? "KYC approuvé" : "KYC rejeté");
    load();
  };

  const viewDoc = async (docId) => {
    const token = localStorage.getItem("fazgom_token");
    const res = await fetch(`${API}/admin/kyc/${docId}/file`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return toast.error("Erreur");
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), "_blank");
  };

  return (
    <div className="space-y-5" data-testid="admin-user-detail">
      <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm text-[#6C6C6C] hover:text-[#1F4E3D]" data-testid="back-to-users">
        <ArrowLeft className="w-4 h-4" /> Retour à la liste
      </Link>

      {/* Header card */}
      <div className="card-flat p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className={`w-16 h-16 rounded-2xl grid place-items-center font-['Manrope'] font-bold text-2xl ${
            u.role === "admin" ? "bg-[#1F4E3D] text-white" :
            u.role === "merchant" ? "bg-[#C84B31] text-white" : "bg-[#ECA869] text-[#2D2D2D]"
          }`}>{u.display_name?.[0]?.toUpperCase()}</div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-['Manrope'] font-extrabold text-2xl">{u.display_name}</h1>
              {u.is_premium && <Crown className="w-5 h-5 text-[#ECA869]" />}
              {u.banned && <span className="text-xs bg-[#D32F2F] text-white px-2 py-0.5 rounded-full font-bold">SUSPENDU</span>}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                u.role === "admin" ? "bg-[#1F4E3D] text-white" :
                u.role === "merchant" ? "bg-[#C84B31] text-white" : "bg-[#ECA869] text-[#2D2D2D]"
              }`}>{u.role}</span>
            </div>
            <div className="text-sm text-[#6C6C6C] mt-1 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {u.phone}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {u.city}</span>
              {u.shop_name && <span>· {u.shop_name}</span>}
              <span>· Inscrit le {u.created_at?.slice(0, 10)}</span>
            </div>
            {u.bio && <p className="text-sm mt-2 text-[#2D2D2D]/85">{u.bio}</p>}
            {u.role === "assistant" && (
              <div className="text-xs mt-2 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1F4E3D]" />
                Note: <strong>{u.rating_avg}</strong> ({u.rating_count} avis) · KYC: <strong>{u.kyc_status}</strong>
                {u.kyc_status === "pending" && (
                  <span className="ml-2">
                    <button onClick={() => decideKyc("approve")} data-testid="kyc-approve-btn" className="text-xs px-2 py-0.5 rounded-full bg-[#1F4E3D] text-white mr-1">Approuver</button>
                    <button onClick={() => decideKyc("reject")} data-testid="kyc-reject-btn" className="text-xs px-2 py-0.5 rounded-full bg-[#C84B31] text-white">Rejeter</button>
                  </span>
                )}
              </div>
            )}
          </div>

          {u.role !== "admin" && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <Button onClick={impersonate} disabled={u.banned} data-testid="detail-impersonate-btn" className="bg-[#1F4E3D] hover:bg-[#163328] text-white rounded-full">
                <LogIn className="w-4 h-4 mr-1" /> Se connecter
              </Button>
              {u.role === "assistant" && (
                <Button onClick={togglePremium} variant="outline" data-testid="detail-premium-btn" className="rounded-full border-[#ECA869] text-[#ECA869] hover:bg-[#ECA869] hover:text-white">
                  {u.is_premium ? "Retirer Premium" : "Donner Premium"}
                </Button>
              )}
              <Button onClick={toggleBan} variant="outline" data-testid="detail-ban-btn" className={`rounded-full ${u.banned ? "border-[#1F4E3D] text-[#1F4E3D]" : "border-[#C84B31] text-[#C84B31]"}`}>
                {u.banned ? <><CheckCircle2 className="w-4 h-4 mr-1"/>Débannir</> : <><Ban className="w-4 h-4 mr-1"/>Suspendre</>}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Formulaire d'édition */}
      {u.role !== "admin" && (
        <div className="card-flat p-5 bg-white space-y-4">
          <h2 className="font-['Manrope'] font-bold text-lg text-[#2D2D2D] border-b border-[#EAE5D9]/60 pb-2">
            Modifier le profil de l'utilisateur
          </h2>
          <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6C6C6C]">Nom complet</label>
              <Input
                required
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                className="h-10 border-[#EAE5D9]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6C6C6C]">Téléphone</label>
              <Input
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-10 border-[#EAE5D9]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6C6C6C]">Ville</label>
              <Input
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="h-10 border-[#EAE5D9]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6C6C6C]">Rôle</label>
              <Select value={form.role} onValueChange={(val) => setForm({ ...form, role: val })}>
                <SelectTrigger className="w-full h-10 border-[#EAE5D9]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="merchant">Commerçant</SelectItem>
                  <SelectItem value="assistant">Assistant de gestion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "merchant" && (
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#6C6C6C]">Nom de la boutique</label>
                <Input
                  value={form.shop_name}
                  onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
                  placeholder="Boutique..."
                  className="h-10 border-[#EAE5D9]"
                />
              </div>
            )}
            <div className="md:col-span-2 flex justify-end pt-2">
              <Button type="submit" disabled={saving} className="bg-[#1F4E3D] hover:bg-[#163328] text-white rounded-xl px-6 h-10 font-bold">
                {saving ? "Enregistrement..." : "Enregistrer les modifications"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Briefcase} label="Missions publiées" v={stats.missions_as_merchant} color="#C84B31" />
        <Stat icon={Briefcase} label="Missions exécutées" v={stats.missions_as_assistant} color="#1F4E3D" />
        <Stat icon={Wallet} label="Gains" v={fmtFCFA(stats.total_earned)} color="#1F4E3D" small />
        <Stat icon={Wallet} label="Dépensé" v={fmtFCFA(stats.total_spent)} color="#C84B31" small />
        <Stat icon={Receipt} label="Caisse" v={stats.cash_entries_count} color="#1F4E3D" />
        <Stat icon={Package} label="Articles stock" v={stats.stock_items_count} color="#1F4E3D" />
        <Stat icon={HandCoins} label="Crédits ouverts" v={stats.open_credits_count} color="#C84B31" />
        <Stat icon={Star} label="Avis reçus" v={stats.reviews_received_count} color="#ECA869" />
      </div>

      {/* Tabs detail */}
      <Tabs defaultValue="missions" className="w-full">
        <TabsList className="grid grid-cols-3 lg:grid-cols-5 w-full">
          <TabsTrigger value="missions" data-testid="tab-missions">Missions</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">Paiements</TabsTrigger>
          <TabsTrigger value="reviews" data-testid="tab-reviews">Avis</TabsTrigger>
          <TabsTrigger value="kyc" data-testid="tab-kyc">KYC</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit ({stats.audit_logs_count})</TabsTrigger>
        </TabsList>

        <TabsContent value="missions" className="mt-4 space-y-2">
          {[...data.missions_as_merchant, ...data.missions_as_assistant].length === 0 && (
            <div className="text-sm text-[#6C6C6C]">Aucune mission.</div>
          )}
          {data.missions_as_merchant.map((m) => (
            <MissionRow key={m.id} m={m} role="merchant" />
          ))}
          {data.missions_as_assistant.map((m) => (
            <MissionRow key={m.id} m={m} role="assistant" />
          ))}
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-2">
          <h3 className="font-bold text-sm uppercase tracking-widest text-[#6C6C6C]">Paiements</h3>
          {data.payments.length === 0 && <div className="text-sm text-[#6C6C6C]">Aucun paiement.</div>}
          {data.payments.map((p) => (
            <div key={p.id} className="card-flat p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">{p.mode} · {p.provider}</div>
                <div className="text-xs text-[#6C6C6C]">{p.status} / escrow {p.escrow_status} · {p.created_at?.slice(0, 10)}</div>
              </div>
              <div className="font-['Manrope'] font-bold">{fmtFCFA(p.amount)}</div>
            </div>
          ))}
          <h3 className="font-bold text-sm uppercase tracking-widest text-[#6C6C6C] mt-4">Versements reçus</h3>
          {data.payouts.length === 0 && <div className="text-sm text-[#6C6C6C]">Aucun versement.</div>}
          {data.payouts.map((p) => (
            <div key={p.id} className="card-flat p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">Net {fmtFCFA(p.net)} (Commission {fmtFCFA(p.commission)})</div>
                <div className="text-xs text-[#6C6C6C]">{p.status} · {p.created_at?.slice(0, 10)}</div>
              </div>
              <div className="font-['Manrope'] font-bold">{fmtFCFA(p.amount)}</div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="reviews" className="mt-4 space-y-2">
          <h3 className="font-bold text-sm uppercase tracking-widest text-[#6C6C6C]">Avis reçus</h3>
          {data.reviews_received.length === 0 && <div className="text-sm text-[#6C6C6C]">Aucun avis.</div>}
          {data.reviews_received.map((r) => <ReviewRow key={r.id} r={r} />)}
          <h3 className="font-bold text-sm uppercase tracking-widest text-[#6C6C6C] mt-4">Avis donnés</h3>
          {data.reviews_given.length === 0 && <div className="text-sm text-[#6C6C6C]">Aucun avis donné.</div>}
          {data.reviews_given.map((r) => <ReviewRow key={r.id} r={r} />)}
        </TabsContent>

        <TabsContent value="kyc" className="mt-4 space-y-2">
          {data.kyc_documents.length === 0 && <div className="text-sm text-[#6C6C6C]">Aucun document téléversé.</div>}
          {data.kyc_documents.map((d) => (
            <div key={d.id} className="card-flat p-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#6C6C6C]" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                  <span>
                    {d.doc_type === "id_card" ? "Carte d'identité" : d.doc_type === "passport" ? "Passeport" : d.doc_type === "diploma" ? "Diplôme" : d.doc_type}
                  </span>
                  {d.expiry_date && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#C84B31]/10 text-[#C84B31] font-bold">
                      Expire le : {new Date(d.expiry_date).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#6C6C6C] truncate">{d.filename} · {Math.round(d.size / 1024)} Ko · {d.uploaded_at?.slice(0, 10)}</div>
              </div>
              <button onClick={() => viewDoc(d.id)} data-testid={`view-kyc-${d.id}`} className="p-2 rounded-lg hover:bg-[#EAE5D9] text-[#1F4E3D]">
                <Eye className="w-4 h-4" />
              </button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="audit" className="mt-4 space-y-2">
          {data.audit_logs.length === 0 ? (
            <div className="text-sm text-[#6C6C6C]">Aucune action effectuée en impersonation pour cet utilisateur.</div>
          ) : (
            data.audit_logs.map((lg) => (
              <div key={lg.id} className="card-flat p-3 text-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <code className="text-xs bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#EAE5D9]">{lg.method} {lg.path}</code>
                  <span className="text-xs text-[#6C6C6C]">{new Date(lg.created_at).toLocaleString("fr-FR")}</span>
                </div>
                {lg.body_preview && (
                  <pre className="mt-2 text-xs bg-[#FAF8F5] p-2 rounded border border-[#EAE5D9] overflow-x-auto max-h-32">{lg.body_preview}</pre>
                )}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon: Icon, label, v, color, small }) {
  return (
    <div className="card-flat p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#6C6C6C] font-bold">
        <Icon className="w-3.5 h-3.5" style={{ color }} /> {label}
      </div>
      <div className={`font-['Manrope'] font-extrabold mt-1 ${small ? "text-base" : "text-2xl"}`} style={{ color }}>
        {v}
      </div>
    </div>
  );
}

function MissionRow({ m, role }) {
  return (
    <div className="card-flat p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-semibold text-sm">{m.title}</div>
        <div className="text-xs text-[#6C6C6C]">
          {role === "merchant" ? "Publiée" : "Exécutée"} · {STATUS_LABELS[m.status]} · {m.created_at?.slice(0, 10)}
        </div>
      </div>
      <div className="font-['Manrope'] font-bold text-[#C84B31]">{fmtFCFA(m.budget_fcfa)}</div>
    </div>
  );
}

function ReviewRow({ r }) {
  return (
    <div className="card-flat p-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={`w-3.5 h-3.5 ${n <= r.stars ? "fill-[#ECA869] text-[#ECA869]" : "text-[#EAE5D9]"}`} />
        ))}
        <span className="text-xs text-[#6C6C6C] ml-1">{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
      </div>
      {r.comment && <div className="text-sm mt-1">{r.comment}</div>}
    </div>
  );
}
