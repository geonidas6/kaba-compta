import React, { useEffect, useState } from "react";
import { Settings, Link2, Crown, MessageCircle, Send, ShieldOff, Star, Database, Download, Upload, RefreshCw, FlaskConical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function AdminSettings() {
  const [s, setS] = useState(null);
  const [pf, setPf] = useState({
    premium_enabled: false,
    premium_price_fcfa: "",
    premium_duration_days: "",
    review_visibility_paywall: false,
    public_backend_url: "",
    whatsapp_service_url: "",
    whatsapp_api_key: "",
    whatsapp_session_id: "default",
    whatsapp_verify_ssl: true,
    notifications_enabled: true,
    cronicle_url: "",
    cronicle_api_key: "",
  });
  const [saving, setSaving] = useState(false);
  const [deployingCronicle, setDeployingCronicle] = useState(false);
  const [cronicleResult, setCronicleResult] = useState(null);
  const [cronicleConfirmOpen, setCronicleConfirmOpen] = useState(false);
  const [waTestPhone, setWaTestPhone] = useState("");
  const [waTesting, setWaTesting] = useState(false);
  const [waResult, setWaResult] = useState(null);

  // Backup & Dev Tools State
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [generatingFake, setGeneratingFake] = useState(false);
  const [resettingDb, setResettingDb] = useState(false);
  const [restoringFile, setRestoringFile] = useState(false);

  const prettyJson = (value) => JSON.stringify(value ?? null, null, 2);

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const r = await api.get("/admin/backup/list");
      setBackups(r.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const createBackup = async () => {
    try {
      const r = await api.post("/admin/backup/create");
      toast.success(r.data.message || "Sauvegarde créée");
      loadBackups();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de la création de la sauvegarde");
    }
  };

  const downloadBackup = async (filename) => {
    try {
      const r = await api.get(`/admin/backup/download/${filename}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      toast.error("Erreur lors du téléchargement");
    }
  };

  const restoreBackup = async (filename) => {
    if (!window.confirm(`ATTENTION : Êtes-vous sûr de vouloir restaurer la sauvegarde "${filename}" ? Cette opération écrasera toutes les données actuelles de la base de données.`)) {
      return;
    }
    toast.info("Restauration en cours...");
    try {
      const r = await api.post(`/admin/backup/restore/${filename}`);
      toast.success(r.data.message || "Restauration effectuée avec succès !");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de la restauration");
    }
  };

  const deleteBackup = async (filename) => {
    if (!window.confirm(`Supprimer définitivement la sauvegarde "${filename}" ?`)) {
      return;
    }
    try {
      await api.delete(`/admin/backup/${filename}`);
      toast.success("Sauvegarde supprimée");
      loadBackups();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de la suppression");
    }
  };

  const handleUploadRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm("ATTENTION : Êtes-vous sûr de vouloir écraser toute la base de données avec les données de ce fichier de sauvegarde ?")) {
      e.target.value = "";
      return;
    }
    setRestoringFile(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const r = await api.post("/admin/backup/upload-restore", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(r.data.message || "Sauvegarde restaurée");
      e.target.value = "";
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de la restauration");
    } finally {
      setRestoringFile(false);
    }
  };

  const generateFakeData = async () => {
    if (!window.confirm("ATTENTION : Cette action supprimera TOUTES les données actuelles (utilisateurs, missions, forum, etc.) pour générer des données de test réalistes. L'administrateur actuel sera conservé.")) {
      return;
    }
    setGeneratingFake(true);
    try {
      const r = await api.post("/admin/dev/generate-fake-data");
      toast.success(r.data.message || "Données de test générées !");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de la génération");
    } finally {
      setGeneratingFake(false);
    }
  };

  const resetDatabase = async () => {
    if (!window.confirm("ATTENTION : Cette action supprimera toutes les données métier (utilisateurs non-admin, missions, messages, forum, KYC, logs, etc.) et remettra la base à neuf. Les comptes administrateurs et les paramètres plateforme seront conservés. Continuer ?")) {
      return;
    }
    setResettingDb(true);
    try {
      const r = await api.post("/admin/dev/reset-database");
      toast.success(r.data.message || "Base réinitialisée");
      await load();
      await loadBackups();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de la réinitialisation");
    } finally {
      setResettingDb(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return "0 octet";
    const k = 1024;
    const sizes = ["octets", "Ko", "Mo", "Go"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const load = async () => {
    const r = await api.get("/admin/settings");
    setS(r.data);
    setPf({
      premium_enabled: r.data.platform.premium_enabled ?? false,
      premium_price_fcfa: r.data.platform.premium_price_fcfa ?? "",
      premium_duration_days: r.data.platform.premium_duration_days ?? "",
      review_visibility_paywall: r.data.platform.review_visibility_paywall ?? false,
      public_backend_url: r.data.platform.public_backend_url || "",
      whatsapp_service_url: r.data.platform.whatsapp_service_url || "",
      whatsapp_api_key: "",
      whatsapp_session_id: r.data.platform.whatsapp_session_id || "default",
      whatsapp_verify_ssl: r.data.platform.whatsapp_verify_ssl ?? true,
      notifications_enabled: r.data.platform.notifications_enabled ?? true,
      cronicle_url: r.data.platform.cronicle_url || "",
      cronicle_api_key: "",
    });
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const whatsappServiceUrl = pf.whatsapp_service_url.trim();
      const publicBackendUrl = pf.public_backend_url.trim();
      const cronicleUrl = pf.cronicle_url.trim();
      if (whatsappServiceUrl && !/^https?:\/\//i.test(whatsappServiceUrl)) {
        toast.error("L'URL du service OpenWA doit commencer par http:// ou https://");
        setSaving(false);
        return;
      }
      if (publicBackendUrl && !/^https?:\/\//i.test(publicBackendUrl)) {
        toast.error("L'URL backend publique doit commencer par http:// ou https://");
        setSaving(false);
        return;
      }
      const payload = {
        premium_enabled: pf.premium_enabled,
        review_visibility_paywall: pf.review_visibility_paywall,
        whatsapp_service_url: whatsappServiceUrl,
        public_backend_url: publicBackendUrl,
        whatsapp_session_id: pf.whatsapp_session_id.trim() || "default",
        whatsapp_verify_ssl: pf.whatsapp_verify_ssl,
        notifications_enabled: pf.notifications_enabled,
        cronicle_url: cronicleUrl,
      };
      if (pf.premium_price_fcfa !== "") payload.premium_price_fcfa = parseFloat(pf.premium_price_fcfa);
      if (pf.premium_duration_days !== "") payload.premium_duration_days = parseInt(pf.premium_duration_days, 10);
      if (pf.whatsapp_api_key) payload.whatsapp_api_key = pf.whatsapp_api_key.trim();
      if (pf.cronicle_api_key) payload.cronicle_api_key = pf.cronicle_api_key.trim();
      await api.put("/admin/settings/platform", payload);
      toast.success("Paramètres enregistrés");
      await load();
    } catch {
      toast.error("Erreur");
    } finally {
      setSaving(false);
    }
  };

  const saveCronicleSettings = async () => {
    setSaving(true);
    try {
      const payload = { cronicle_url: pf.cronicle_url.trim() };
      if (pf.cronicle_api_key) payload.cronicle_api_key = pf.cronicle_api_key.trim();
      await api.put("/admin/settings/platform", payload);
      toast.success("Paramètres Cronicle enregistrés");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de l'enregistrement Cronicle");
    } finally {
      setSaving(false);
    }
  };

  const redeployCronicle = async () => {
    setDeployingCronicle(true);
    setCronicleResult(null);
    try {
      const r = await api.post("/admin/cronicle/redeploy");
      setCronicleResult(r.data);
      setCronicleConfirmOpen(false);
      const errors = r.data.errors?.length || 0;
      if (errors) {
        toast.error(`Cronicle terminé avec ${errors} erreur(s)`);
      } else {
        toast.success(`${r.data.created?.length || 0} tâche(s) Cronicle recréée(s)`);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const message = typeof detail === "string" ? detail : detail?.message || "Erreur Cronicle";
      setCronicleResult({
        deleted: [],
        created: [],
        errors: [{ message }],
        requests: detail?.request ? [detail.request] : detail?.requests || [],
      });
      toast.error("Erreur Cronicle. Consultez le détail dans la carte.");
    } finally {
      setDeployingCronicle(false);
    }
  };

  const testWhatsApp = async () => {
    if (!waTestPhone) return toast.error("Entrez un numéro");
    if (!pf.whatsapp_service_url || !/^https?:\/\//i.test(pf.whatsapp_service_url.trim())) {
      return toast.error("Corrigez et enregistrez l'URL du service OpenWA avant le test");
    }
    setWaTesting(true);
    setWaResult(null);
    try {
      const r = await api.post("/admin/whatsapp/test", { phone: waTestPhone });
      setWaResult(r.data);
      if (r.data.ok) toast.success("Message WhatsApp envoyé !");
      else toast.error(`Échec (HTTP ${r.data.status_code || "?"})`);
    } catch (err) {
      const detail = err?.response?.data;
      const message = detail?.detail || err?.message || "Erreur";
      setWaResult({
        ok: false,
        error: message,
        api_response: {
          status_code: err?.response?.status || null,
          json: detail || null,
          text: typeof detail === "string" ? detail : message,
        },
      });
      toast.error(message);
    } finally {
      setWaTesting(false);
    }
  };

  if (!s) return <div className="text-[#6C6C6C]">Chargement...</div>;

  return (
    <div className="space-y-6" data-testid="admin-settings-page">
      <div>
        <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Console admin</p>
        <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1 flex items-center gap-2">
          <Settings className="w-7 h-7 text-[#1F4E3D]" /> Paramètres
        </h1>
      </div>

      <form onSubmit={save} className="card-flat p-5 space-y-5" data-testid="platform-form">
        {/* Premium */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-[#ECA869]" />
            <h2 className="font-['Manrope'] font-bold text-lg">Abonnement Premium comptables</h2>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE5D9]">
            <Switch
              checked={pf.premium_enabled}
              onCheckedChange={(v) => setPf({ ...pf, premium_enabled: v })}
              data-testid="premium-switch"
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-['Manrope'] font-bold">
                {pf.premium_enabled ? "Premium activé" : "Premium désactivé (gratuit pour tous)"}
              </div>
              <p className="text-xs text-[#6C6C6C] mt-1">
                Active la mise en avant payante des comptables Premium.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Prix (FCFA)</Label>
              <Input
                type="number"
                min="0"
                data-testid="pf-premium-price-input"
                value={pf.premium_price_fcfa}
                onChange={(e) => setPf({ ...pf, premium_price_fcfa: e.target.value })}
                className="h-11"
                placeholder="2000"
              />
            </div>
            <div>
              <Label>Durée (jours)</Label>
              <Input
                type="number"
                min="1"
                data-testid="pf-premium-duration-input"
                value={pf.premium_duration_days}
                onChange={(e) => setPf({ ...pf, premium_duration_days: e.target.value })}
                className="h-11"
                placeholder="30"
              />
            </div>
          </div>
        </div>

        {/* Reviews paywall */}
        <div className="border-t border-[#EAE5D9] pt-5 space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-[#ECA869]" />
            <h2 className="font-['Manrope'] font-bold text-lg">Visibilité des avis</h2>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE5D9]">
            <Switch
              checked={pf.review_visibility_paywall}
              onCheckedChange={(v) => setPf({ ...pf, review_visibility_paywall: v })}
              data-testid="reviews-paywall-switch"
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-['Manrope'] font-bold">
                {pf.review_visibility_paywall ? "Avis Premium uniquement" : "Avis visibles pour tous"}
              </div>
              <p className="text-xs text-[#6C6C6C] mt-1">
                Quand activé, seuls les comptables Premium affichent leurs avis publiquement. À garder désactivé au launch.
              </p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="border-t border-[#EAE5D9] pt-5 space-y-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#1F4E3D]" />
            <h2 className="font-['Manrope'] font-bold text-lg">Notifications WhatsApp</h2>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE5D9]">
            <Switch
              checked={pf.notifications_enabled}
              onCheckedChange={(v) => setPf({ ...pf, notifications_enabled: v })}
              data-testid="notifications-switch"
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-['Manrope'] font-bold">
                {pf.notifications_enabled ? "Notifications actives" : "Notifications désactivées"}
              </div>
              <p className="text-xs text-[#6C6C6C] mt-1">
                Envois automatiques sur événements (nouvelle offre, message, mission attribuée, etc.).
              </p>
            </div>
          </div>
        </div>

        {/* Infrastructure */}
        <div className="border-t border-[#EAE5D9] pt-5 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#1F4E3D]" />
            <h2 className="font-['Manrope'] font-bold text-lg">Infrastructure</h2>
          </div>
          <div>
            <Label>URL backend publique</Label>
            <Input
              data-testid="pf-backend-url-input"
              value={pf.public_backend_url}
              onChange={(e) => setPf({ ...pf, public_backend_url: e.target.value })}
              className="h-11"
              placeholder="https://api.kaba-compta.tg"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-5 h-5 text-[#1F4E3D]" />
              <h3 className="font-['Manrope'] font-bold">WhatsApp (OpenWA)</h3>
              {s.platform.whatsapp_api_key_set && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#1F4E3D]/10 text-[#1F4E3D] font-semibold">configuré</span>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <Label>URL du service OpenWA</Label>
                <Input
                  data-testid="pf-whatsapp-input"
                  value={pf.whatsapp_service_url}
                  onChange={(e) => setPf({ ...pf, whatsapp_service_url: e.target.value })}
                  className="h-11"
                  placeholder="https://openwa-api.example.com"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Session ID</Label>
                  <Input
                    data-testid="pf-whatsapp-session-input"
                    value={pf.whatsapp_session_id}
                    onChange={(e) => setPf({ ...pf, whatsapp_session_id: e.target.value })}
                    className="h-11"
                    placeholder="default"
                  />
                </div>
                <div>
                  <Label>X-API-Key OpenWA</Label>
                  <Input
                    type="password"
                    data-testid="pf-whatsapp-key-input"
                    value={pf.whatsapp_api_key}
                    onChange={(e) => setPf({ ...pf, whatsapp_api_key: e.target.value })}
                    className="h-11 font-mono"
                    placeholder={s.platform.whatsapp_api_key_set ? s.platform.whatsapp_api_key_masked || "•••••" : "owa_xxxxxxxx"}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[#FAF8F5] border border-[#EAE5D9]">
                <Switch
                  checked={pf.whatsapp_verify_ssl}
                  onCheckedChange={(v) => setPf({ ...pf, whatsapp_verify_ssl: v })}
                  data-testid="pf-whatsapp-ssl-switch"
                  className="mt-1"
                />
                <div className="flex-1 text-sm">
                  <div className="font-semibold flex items-center gap-1.5">
                    Vérifier le certificat SSL
                    {!pf.whatsapp_verify_ssl && <span className="text-xs text-[#C84B31] flex items-center gap-0.5"><ShieldOff className="w-3 h-3" />désactivé</span>}
                  </div>
                  <p className="text-xs text-[#6C6C6C]">
                    Désactivez uniquement avec un certificat auto-signé.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-[#1F4E3D]/5 border border-[#1F4E3D]/20">
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <div className="font-['Manrope'] font-bold text-sm">Tester l'envoi WhatsApp</div>
                {(!s.platform.whatsapp_api_key_set || !pf.whatsapp_service_url) && (
                  <span className="text-xs text-[#C84B31] font-semibold">Enregistrez l'URL OpenWA et la clé API avant le test</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  data-testid="wa-test-phone-input"
                  value={waTestPhone}
                  onChange={(e) => setWaTestPhone(e.target.value)}
                  placeholder="+22890000000"
                  className="h-10 flex-1 min-w-[200px]"
                />
                <Button
                  type="button"
                  onClick={testWhatsApp}
                  disabled={waTesting}
                  data-testid="wa-test-btn"
                  className="bg-[#1F4E3D] hover:bg-[#163328] text-white rounded-full h-10"
                >
                  <Send className="w-4 h-4 mr-1" /> {waTesting ? "Envoi..." : "Envoyer test"}
                </Button>
              </div>
              {waResult && (
                  <div
                    data-testid="wa-test-result"
                    className={`mt-3 rounded border overflow-hidden ${waResult.ok ? "bg-[#1F4E3D]/10 border-[#1F4E3D]/30" : "bg-[#C84B31]/10 border-[#C84B31]/30"}`}
                  >
                    <div className={`px-3 py-2 text-xs font-bold border-b ${waResult.ok ? "border-[#1F4E3D]/20 text-[#1F4E3D]" : "border-[#C84B31]/20 text-[#C84B31]"}`}>
                      {waResult.ok ? "Test envoyé" : "Échec du test"}
                      {waResult.status_code ? ` · HTTP ${waResult.status_code}` : ""}
                    </div>
                    <div className="grid md:grid-cols-2 gap-0">
                      <div className="p-3 border-b md:border-b-0 md:border-r border-black/10">
                        <div className="font-['Manrope'] font-bold text-xs mb-2 text-[#2E2E2E]">Envoyé à OpenWA</div>
                        <pre className="text-xs p-2 rounded bg-white/80 border border-black/10 max-h-64 overflow-auto text-[#2E2E2E]">
                          {prettyJson(waResult.sent || { endpoint: waResult.endpoint, phone_sent_to: waResult.phone_sent_to })}
                        </pre>
                      </div>
                      <div className="p-3">
                        <div className="font-['Manrope'] font-bold text-xs mb-2 text-[#2E2E2E]">Réponse de l'API</div>
                        <pre className="text-xs p-2 rounded bg-white/80 border border-black/10 max-h-64 overflow-auto text-[#2E2E2E]">
                          {prettyJson(waResult.api_response || { error: waResult.error, response: waResult.response })}
                        </pre>
                      </div>
                    </div>
                  </div>
              )}
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={saving}
          data-testid="pf-save-btn"
          className="bg-[#1F4E3D] hover:bg-[#163328] text-white rounded-full"
        >
          {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
        </Button>
      </form>



      <div className="card-flat p-5 space-y-4" data-testid="cronicle-jobs-card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#1F4E3D]" />
            <h2 className="font-['Manrope'] font-bold text-lg">Tâches Cronicle</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              onClick={saveCronicleSettings}
              disabled={saving}
              data-testid="cronicle-save-btn"
              variant="outline"
              className="border-[#1F4E3D] text-[#1F4E3D] hover:bg-[#1F4E3D]/5 rounded-full text-xs h-9"
            >
              {saving ? "Enregistrement..." : "Enregistrer Cronicle"}
            </Button>
            <Button
              type="button"
              onClick={() => setCronicleConfirmOpen(true)}
              disabled={deployingCronicle || !s?.platform?.cronicle_url || !s?.platform?.cronicle_api_key_set}
              data-testid="cronicle-redeploy-btn"
              className="bg-[#1F4E3D] hover:bg-[#163328] text-white rounded-full text-xs h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${deployingCronicle ? "animate-spin" : ""}`} />
              {deployingCronicle ? "Déploiement..." : "Supprimer et recréer les tâches"}
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>URL API Cronicle</Label>
            <Input
              value={pf.cronicle_url}
              onChange={(e) => setPf({ ...pf, cronicle_url: e.target.value })}
              className="h-11"
              placeholder="http://cronicle:3012"
              data-testid="cronicle-url-input"
            />
            <p className="text-xs text-[#6C6C6C] mt-1">Utilisez l'URL API accessible depuis le conteneur Kaba-Compta. Recommandé : http://cronicle:3012</p>
          </div>
          <div>
            <Label>Token API Cronicle</Label>
            <Input
              type="password"
              value={pf.cronicle_api_key}
              onChange={(e) => setPf({ ...pf, cronicle_api_key: e.target.value })}
              className="h-11 font-mono"
              placeholder={s?.platform?.cronicle_api_key_set ? s.platform.cronicle_api_key_masked || "•••••" : "clé API Cronicle"}
              autoComplete="off"
              data-testid="cronicle-token-input"
            />
          </div>
        </div>

        {(!s?.platform?.cronicle_url || !s?.platform?.cronicle_api_key_set) && (
          <div className="rounded-xl border border-[#ECA869]/50 bg-[#ECA869]/10 p-3 text-xs text-[#6C6C6C]">
            Enregistrez d'abord l'URL Cronicle et le token API avant de lancer la création automatique des tâches.
          </div>
        )}

        {cronicleConfirmOpen && (
          <div className="rounded-xl border border-[#ECA869]/60 bg-[#FFF4E3] p-4" data-testid="cronicle-confirm-panel">
            <div className="font-['Manrope'] font-bold text-[#2D2D2D]">Confirmer le redéploiement Cronicle</div>
            <p className="text-xs text-[#6C6C6C] mt-1 max-w-3xl">
              Cette action supprimera uniquement les tâches dont le nom commence par <strong>Kaba-Compta -</strong>, puis recréera les tâches planifiées de l'application. Les autres tâches Cronicle ne seront pas touchées.
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCronicleConfirmOpen(false)}
                disabled={deployingCronicle}
                className="rounded-full h-9 text-xs"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={redeployCronicle}
                disabled={deployingCronicle}
                data-testid="cronicle-confirm-redeploy-btn"
                className="bg-[#1F4E3D] hover:bg-[#163328] text-white rounded-full text-xs h-9"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${deployingCronicle ? "animate-spin" : ""}`} />
                {deployingCronicle ? "Déploiement..." : "Confirmer et recréer"}
              </Button>
            </div>
          </div>
        )}

        {cronicleResult && (
          <div
            className={`rounded-xl border overflow-hidden ${cronicleResult.errors?.length ? "border-[#C84B31]/40 bg-[#C84B31]/10" : "border-[#1F4E3D]/30 bg-[#1F4E3D]/10"}`}
            data-testid="cronicle-result"
          >
            <div className={`px-3 py-2 text-xs font-bold border-b ${cronicleResult.errors?.length ? "border-[#C84B31]/20 text-[#C84B31]" : "border-[#1F4E3D]/20 text-[#1F4E3D]"}`}>
              {cronicleResult.errors?.length ? "Cronicle terminé avec erreur" : "Tâches Cronicle recréées"}
            </div>
            <div className="p-3 grid sm:grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg bg-white/80 border border-black/10 p-3">
                <div className="font-['Manrope'] font-extrabold text-xl text-[#1F4E3D]">{cronicleResult.created?.length || 0}</div>
                <div className="text-[#6C6C6C] font-semibold">créée(s)</div>
              </div>
              <div className="rounded-lg bg-white/80 border border-black/10 p-3">
                <div className="font-['Manrope'] font-extrabold text-xl text-[#1F4E3D]">{cronicleResult.deleted?.length || 0}</div>
                <div className="text-[#6C6C6C] font-semibold">supprimée(s)</div>
              </div>
              <div className="rounded-lg bg-white/80 border border-black/10 p-3">
                <div className={`font-['Manrope'] font-extrabold text-xl ${cronicleResult.errors?.length ? "text-[#C84B31]" : "text-[#1F4E3D]"}`}>{cronicleResult.errors?.length || 0}</div>
                <div className="text-[#6C6C6C] font-semibold">erreur(s)</div>
              </div>
            </div>
            {cronicleResult.requests?.length > 0 && (
              <div className="px-3 pb-3">
                <div className="font-['Manrope'] font-bold text-xs mb-2 text-[#2D2D2D]">Requête envoyée à Cronicle</div>
                <pre className="overflow-x-auto rounded-lg bg-white/90 border border-black/10 p-2 text-xs text-[#2D2D2D] max-h-80">{prettyJson(cronicleResult.requests)}</pre>
              </div>
            )}
            {cronicleResult.errors?.length > 0 && (
              <div className="px-3 pb-3">
                <div className="font-['Manrope'] font-bold text-xs mb-2 text-[#2D2D2D]">Détail de l'erreur</div>
                <pre className="overflow-x-auto rounded-lg bg-white/90 border border-black/10 p-2 text-xs text-[#2D2D2D] max-h-64">{prettyJson(cronicleResult.errors)}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dev Tools & Seed Data */}
      <div className="card-flat p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-[#C84B31]" />
          <h2 className="font-['Manrope'] font-bold text-lg text-[#C84B31]">Données de test / Développement</h2>
        </div>
        <p className="text-xs text-[#6C6C6C]">
          Permet de peupler rapidement la base de données avec des profils (commerçants, assistants de gestion comptable), des missions, des offres et des questions de forum réalistes pour tester toutes les fonctionnalités de la plateforme.
        </p>
        <Button
          type="button"
          disabled={generatingFake}
          onClick={generateFakeData}
          className="bg-[#C84B31] hover:bg-[#a63d27] text-white rounded-full"
        >
          {generatingFake ? "Génération en cours..." : "Générer les données de test (Kaba-Compta Lomé)"}
        </Button>
        <Button
          type="button"
          disabled={resettingDb}
          onClick={resetDatabase}
          data-testid="reset-db-btn"
          className="bg-[#9E2A2B] hover:bg-[#7f1f21] text-white rounded-full"
        >
          {resettingDb ? "Réinitialisation en cours..." : "Réinitialiser la base (garder admins)"}
        </Button>
      </div>

      {/* Backups & Restore */}
      <div className="card-flat p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#1F4E3D]" />
            <h2 className="font-['Manrope'] font-bold text-lg">Sauvegarde & Restauration</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={createBackup}
              className="bg-[#1F4E3D] hover:bg-[#163328] text-white rounded-full text-xs h-9"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Créer une sauvegarde
            </Button>
            <label className="bg-white border border-[#1F4E3D] text-[#1F4E3D] hover:bg-[#1F4E3D]/5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>{restoringFile ? "Restauration..." : "Restaurer depuis un fichier"}</span>
              <input
                type="file"
                accept=".zip"
                onChange={handleUploadRestore}
                disabled={restoringFile}
                className="hidden"
              />
            </label>
          </div>
        </div>
        
        <p className="text-xs text-[#6C6C6C]">
          Sauvegarde complète au format ZIP comprenant la structure et les données de toutes les collections MongoDB (utilisateurs, paramètres, messages, KYC...) ainsi que les fichiers importés stockés localement.
        </p>


        <div className="border border-[#EAE5D9] rounded-xl overflow-hidden divide-y divide-[#EAE5D9]">
          {loadingBackups ? (
            <div className="p-6 text-center text-[#6C6C6C] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#1F4E3D]" />
              Chargement des sauvegardes...
            </div>
          ) : backups.length === 0 ? (
            <div className="p-6 text-center text-[#6C6C6C]">
              Aucune sauvegarde trouvée dans le répertoire. Cliquez sur "Créer une sauvegarde" pour commencer.
            </div>
          ) : (
            backups.map((b) => (
              <div key={b.filename} className="p-3 flex items-center justify-between gap-3 bg-[#FAF8F5]/50">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-semibold text-[#2D2D2D] truncate">
                    {b.filename}
                  </div>
                  <div className="text-[10px] text-[#6C6C6C] mt-0.5">
                    {new Date(b.created_at).toLocaleString()} · {formatSize(b.size)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => downloadBackup(b.filename)}
                    className="h-8 px-2.5 rounded-lg text-xs"
                    title="Télécharger l'archive ZIP"
                  >
                    <Download className="w-3 h-3 mr-1" /> Télécharger
                  </Button>
                  <Button
                    type="button"
                    onClick={() => restoreBackup(b.filename)}
                    className="bg-[#1F4E3D] hover:bg-[#163328] text-white h-8 px-2.5 rounded-lg text-xs"
                    title="Restaurer cette sauvegarde"
                  >
                    Restaurer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => deleteBackup(b.filename)}
                    className="h-8 px-2.5 rounded-lg text-xs border-[#C84B31] text-[#C84B31] hover:bg-[#C84B31]/10"
                    title="Supprimer cette sauvegarde"
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Supprimer
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
