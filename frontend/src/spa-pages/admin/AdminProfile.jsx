import React, { useState } from "react";
import { KeyRound, Save, ShieldCheck, Smartphone, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function StatusPill({ active }) {
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded-full ${active ? "bg-[#1F4E3D] text-white" : "bg-[#EAE5D9] text-[#6C6C6C]"}`}>
      {active ? "Activé" : "Désactivé"}
    </span>
  );
}

export default function AdminProfile() {
  const { user, refresh } = useAuth();
  const [profile, setProfile] = useState({
    display_name: user?.display_name || "",
    email: user?.email || "",
    city: user?.city || "",
    bio: user?.bio || "",
  });
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirm: "" });
  const [setup, setSetup] = useState(null);
  const [totpCode, setTotpCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [securitySaving, setSecuritySaving] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/profile", { ...profile, email: profile.email?.trim() });
      await refresh();
      toast.success("Profil admin mis à jour");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm) return toast.error("Les mots de passe ne correspondent pas");
    setSaving(true);
    try {
      await api.put("/auth/password", {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPasswords({ current_password: "", new_password: "", confirm: "" });
      toast.success("Mot de passe modifié");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Impossible de modifier le mot de passe");
    } finally {
      setSaving(false);
    }
  };

  const updateWhatsappOtp = async (enabled) => {
    setSecuritySaving(true);
    try {
      await api.put("/auth/security", { whatsapp_login_otp_enabled: enabled });
      await refresh();
      toast.success(enabled ? "OTP WhatsApp activé" : "OTP WhatsApp désactivé");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Impossible de modifier ce réglage");
    } finally {
      setSecuritySaving(false);
    }
  };

  const startTotpSetup = async () => {
    setSecuritySaving(true);
    try {
      const r = await api.post("/auth/2fa/totp/setup");
      setSetup(r.data);
      setTotpCode("");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Configuration impossible");
    } finally {
      setSecuritySaving(false);
    }
  };

  const enableTotp = async () => {
    setSecuritySaving(true);
    try {
      await api.post("/auth/2fa/totp/enable", { code: totpCode });
      await refresh();
      setSetup(null);
      setTotpCode("");
      toast.success("Application d'authentification activée");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Code incorrect");
    } finally {
      setSecuritySaving(false);
    }
  };

  const disableTotp = async () => {
    setSecuritySaving(true);
    try {
      await api.post("/auth/2fa/totp/disable");
      await refresh();
      setSetup(null);
      toast.success("Application d'authentification désactivée");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Désactivation impossible");
    } finally {
      setSecuritySaving(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="admin-profile-page">
      <div>
        <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Console admin</p>
        <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1 flex items-center gap-2">
          <User className="w-7 h-7 text-[#C84B31]" /> Mon profil
        </h1>
      </div>

    <form onSubmit={saveProfile} className="card-flat p-5 space-y-4">
      <h2 className="font-['Manrope'] font-bold text-xl">Informations du compte</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Nom affiché</Label>
          <Input value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} className="h-11" />
        </div>
        <div>
          <Label>Adresse email <span className="text-[#C84B31]">*</span></Label>
          <Input value={profile.email || ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="h-11" type="email" required />
        </div>
        <div>
          <Label>Téléphone</Label>
          <Input value={user?.phone || ""} disabled className="h-11 bg-[#FAF8F5]" />
        </div>
        <div>
          <Label>Ville</Label>
          <Input value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} className="h-11" />
        </div>
          <div>
            <Label>Rôle</Label>
            <Input value="Administrateur" disabled className="h-11 bg-[#FAF8F5]" />
          </div>
        </div>
        <div>
          <Label>Note interne</Label>
          <Textarea rows={3} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
        </div>
        <Button disabled={saving} className="rounded-full bg-[#1F4E3D] hover:bg-[#163328] text-white">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </form>

      <div className="card-flat p-5 space-y-4">
        <h2 className="font-['Manrope'] font-bold text-xl flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#1F4E3D]" /> Sécurité de connexion</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#EAE5D9] bg-white p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-[#1F4E3D] mt-0.5" />
              <div className="flex-1">
                <div className="font-bold">OTP par WhatsApp</div>
                <p className="text-sm text-[#6C6C6C]">Demander un code WhatsApp à chaque connexion admin.</p>
              </div>
              <StatusPill active={user?.whatsapp_login_otp_enabled} />
            </div>
            <Button type="button" disabled={securitySaving} variant={user?.whatsapp_login_otp_enabled ? "outline" : "default"} onClick={() => updateWhatsappOtp(!user?.whatsapp_login_otp_enabled)} className={user?.whatsapp_login_otp_enabled ? "rounded-full" : "rounded-full bg-[#1F4E3D] hover:bg-[#163328] text-white"}>
              {user?.whatsapp_login_otp_enabled ? "Désactiver" : "Activer"}
            </Button>
          </div>

          <div className="rounded-xl border border-[#EAE5D9] bg-white p-4 space-y-3">
            <div className="flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-[#1F4E3D] mt-0.5" />
              <div className="flex-1">
                <div className="font-bold">Application d'authentification</div>
                <p className="text-sm text-[#6C6C6C]">Activer un code TOTP avec Google Authenticator ou équivalent.</p>
              </div>
              <StatusPill active={user?.totp_enabled} />
            </div>

            {setup && !user?.totp_enabled && (
              <div className="rounded-xl bg-[#FAF8F5] border border-[#EAE5D9] p-3 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <img src={setup.qr_data_url} alt="QR code application d'authentification" className="w-36 h-36 rounded-lg border border-[#EAE5D9] bg-white" />
                  <p className="font-mono text-xs break-all bg-white rounded-lg border border-[#EAE5D9] p-2">{setup.secret}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="Code à 6 chiffres" className="h-11 font-mono tracking-widest" />
                  <Button type="button" disabled={securitySaving || totpCode.length < 6} onClick={enableTotp} className="bg-[#1F4E3D] hover:bg-[#163328] text-white rounded-full">Valider</Button>
                </div>
              </div>
            )}

            {user?.totp_enabled ? (
              <Button type="button" disabled={securitySaving} variant="outline" onClick={disableTotp} className="rounded-full">Désactiver</Button>
            ) : (
              <Button type="button" disabled={securitySaving} onClick={startTotpSetup} className="rounded-full bg-[#1F4E3D] hover:bg-[#163328] text-white">Configurer</Button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={changePassword} className="card-flat p-5 space-y-4">
        <h2 className="font-['Manrope'] font-bold text-xl">Modifier le mot de passe</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Mot de passe actuel</Label>
            <Input type="password" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} required className="h-11" />
          </div>
          <div>
            <Label>Nouveau mot de passe</Label>
            <Input type="password" value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} required minLength={6} className="h-11" />
          </div>
          <div>
            <Label>Confirmer</Label>
            <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} required minLength={6} className="h-11" />
          </div>
        </div>
        <Button disabled={saving} className="rounded-full bg-[#C84B31] hover:bg-[#A83E28] text-white">
          <KeyRound className="w-4 h-4 mr-2" /> Changer le mot de passe
        </Button>
      </form>
    </div>
  );
}
