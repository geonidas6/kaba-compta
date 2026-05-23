import React, { useEffect, useState } from "react";
import { User, Upload, Star, ShieldCheck, FileText } from "lucide-react";
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

export default function Profile() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({
    display_name: user?.display_name || "",
    shop_name: user?.shop_name || "",
    city: user?.city || "",
    bio: user?.bio || "",
    avatar_url: user?.avatar_url || "",
  });
  const [reviews, setReviews] = useState([]);
  const [docs, setDocs] = useState([]);
  const [docType, setDocType] = useState("id_card");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get(`/reviews/user/${user.id}`).then((r) => setReviews(r.data));
    if (user.role === "assistant") api.get("/kyc/my").then((r) => setDocs(r.data));
  }, [user.id, user.role]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/profile", form);
      await refresh();
      toast.success("Profil mis à jour");
    } finally { setSaving(false); }
  };

  const uploadKyc = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Sélectionnez un fichier");
    if (docType !== "diploma" && !expiryDate) {
      return toast.error("La date d'expiration est obligatoire");
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("doc_type", docType);
    if (docType !== "diploma" && expiryDate) {
      fd.append("expiry_date", expiryDate);
    }
    try {
      await api.post("/kyc/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Document chiffré et envoyé pour vérification");
      setFile(null);
      setExpiryDate("");
      const r = await api.get("/kyc/my");
      setDocs(r.data);
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-4" data-testid="profile-page">
      <div>
        <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Mon compte</p>
        <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1 flex items-center gap-2">
          <User className="w-7 h-7 text-[#C84B31]" /> Profil
        </h1>
      </div>

      <div className="card-flat p-4">
        <div className="flex items-center gap-3 mb-4">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="Profile" className="w-14 h-14 rounded-full object-cover border border-[#EAE5D9]" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#C84B31] text-white grid place-items-center font-['Manrope'] font-bold text-xl">
              {user?.display_name?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-['Manrope'] font-bold text-lg">{user?.display_name}</div>
            <div className="text-xs text-[#6C6C6C]">{user?.phone} · {user?.role === "merchant" ? "Commerçant" : "Assistant comptable"}</div>
            {user?.rating_count > 0 && (
              <div className="text-xs flex items-center gap-1 mt-1">
                <Star className="w-3 h-3 fill-[#ECA869] text-[#ECA869]" />
                {user.rating_avg} / 5 ({user.rating_count} avis)
              </div>
            )}
          </div>
        </div>

        <form onSubmit={save} className="space-y-3" data-testid="profile-form">
          <div>
            <Label>Nom affiché</Label>
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="h-11" data-testid="profile-name-input" />
          </div>
          <div>
            <Label>Photo de profil</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.append("file", file);
                try {
                  toast.loading("Téléchargement de l'image...", { id: "avatar-upload" });
                  const res = await api.post("/profile/avatar", fd, {
                    headers: { "Content-Type": "multipart/form-data" }
                  });
                  setForm(prev => ({ ...prev, avatar_url: res.data.avatar_url }));
                  await refresh();
                  toast.success("Photo de profil mise à jour !", { id: "avatar-upload" });
                } catch (err) {
                  toast.error(err?.response?.data?.detail || "Erreur de téléversement", { id: "avatar-upload" });
                }
              }}
              className="h-11 bg-white cursor-pointer file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#1F4E3D]/10 file:text-[#1F4E3D] hover:file:bg-[#1F4E3D]/20"
              data-testid="profile-avatar-upload"
            />
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
          <div>
            <Label>{user.role === "assistant" ? "À propos (votre expérience)" : "Description"}</Label>
            <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} data-testid="profile-bio-input" />
          </div>
          <Button type="submit" disabled={saving} data-testid="profile-save-btn" className="bg-[#1F4E3D] hover:bg-[#163328] text-white rounded-full">
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>
      </div>

      {user.role === "assistant" && (
        <div className="card-flat p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-[#1F4E3D]" />
            <h2 className="font-['Manrope'] font-bold">Vérification KYC</h2>
            <span className="ml-auto text-xs text-[#6C6C6C]">Statut : {user.kyc_status}</span>
          </div>
          <p className="text-sm text-[#6C6C6C] mb-3">
            Téléversez votre pièce d'identité (carte d'identité ou passeport) et votre diplôme. Les fichiers sont chiffrés (AES-256).
          </p>
          <form onSubmit={uploadKyc} className="space-y-3" data-testid="kyc-form">
            <div className="space-y-1">
              <Label className="text-xs text-[#6C6C6C]">Type de document</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-11" data-testid="kyc-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="id_card">Carte d'identité</SelectItem>
                  <SelectItem value="passport">Passeport</SelectItem>
                  <SelectItem value="diploma">Diplôme Licence</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {docType !== "diploma" && (
              <div className="space-y-1">
                <Label className="text-xs text-[#6C6C6C]">Date d'expiration du document</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="h-11 bg-white"
                  required
                  data-testid="kyc-expiry-input"
                />
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
                <div key={d.id} className="flex items-center gap-2 text-sm" data-testid={`kyc-doc-${d.id}`}>
                  <FileText className="w-4 h-4 text-[#6C6C6C]" />
                  <span className="font-semibold">
                    {d.doc_type === "id_card" ? "Carte d'identité" : d.doc_type === "passport" ? "Passeport" : "Diplôme"}
                  </span>
                  {d.expiry_date && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#C84B31]/10 text-[#C84B31] font-bold">
                      Expire le : {new Date(d.expiry_date).toLocaleDateString("fr-FR")}
                    </span>
                  )}
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
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`w-3.5 h-3.5 ${n <= r.stars ? "fill-[#ECA869] text-[#ECA869]" : "text-[#EAE5D9]"}`} />
                  ))}
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
