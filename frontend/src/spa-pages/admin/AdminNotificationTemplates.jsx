import React, { useEffect, useRef, useState } from "react";
import { BellRing, Bold, Clock3, Italic, List, MessageCircle, Quote, Save, Strikethrough, ToggleLeft, Type, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { toast } from "sonner";

function renderWhatsAppPreview(text = "") {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/```([^`]+)```/g, "<code>$1</code>")
    .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/~([^~\n]+)~/g, "<s>$1</s>")
    .replace(/\n/g, "<br />");
}

function WhatsAppEditor({ label, value, onChange, rows = 4 }) {
  const ref = useRef(null);

  const wrapSelection = (before, after = before, placeholder = "texte") => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertLinePrefix = (prefix) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(start);
    const needsNewLine = before && !before.endsWith("\n");
    const next = before + (needsNewLine ? "\n" : "") + prefix + "texte" + after;
    onChange(next);
    requestAnimationFrame(() => el.focus());
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-xs font-bold text-[#2D2D2D]">{label}</label>
        <div className="flex items-center gap-1 rounded-full border border-[#EAE5D9] bg-white p-1">
          <button type="button" onClick={() => wrapSelection("*", "*", "gras")} className="p-1.5 rounded-full hover:bg-[#FAF8F5]" title="Gras WhatsApp"><Bold className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => wrapSelection("_", "_", "italique")} className="p-1.5 rounded-full hover:bg-[#FAF8F5]" title="Italique WhatsApp"><Italic className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => wrapSelection("~", "~", "barré")} className="p-1.5 rounded-full hover:bg-[#FAF8F5]" title="Barré WhatsApp"><Strikethrough className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => wrapSelection("```", "```", "code")} className="p-1.5 rounded-full hover:bg-[#FAF8F5]" title="Monospace WhatsApp"><Type className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => insertLinePrefix("- ")} className="p-1.5 rounded-full hover:bg-[#FAF8F5]" title="Liste"><List className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => insertLinePrefix("> ")} className="p-1.5 rounded-full hover:bg-[#FAF8F5]" title="Citation"><Quote className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <textarea
        ref={ref}
        rows={rows}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[#EAE5D9] bg-white px-3 py-2 text-sm shadow-sm focus:border-[#1F4E3D] focus:outline-none focus:ring-2 focus:ring-[#1F4E3D]/10"
      />
      <div className="rounded-xl border border-[#EAE5D9] bg-[#FAF8F5] p-3 text-sm text-[#2D2D2D]">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[#6C6C6C]">Aperçu WhatsApp</div>
        <div dangerouslySetInnerHTML={{ __html: renderWhatsAppPreview(value || "") }} />
      </div>
    </div>
  );
}

export default function AdminNotificationTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/notification-templates");
      setTemplates(r.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Impossible de charger les modèles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateTemplate = (key, patch) => {
    setTemplates((items) => items.map((item) => item.key === key ? { ...item, ...patch } : item));
  };

  const saveTemplate = async (tpl) => {
    setSavingKey(tpl.key);
    try {
      await api.put(`/admin/notification-templates/${tpl.key}`, {
        title_template: tpl.title_template || "",
        body_template: tpl.body_template || "",
        whatsapp_template: tpl.whatsapp_template || "",
        enabled: tpl.enabled !== false,
      });
      toast.success("Modèle enregistré");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de l’enregistrement");
    } finally {
      setSavingKey("");
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-notification-templates-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Notifications</p>
          <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1 flex items-center gap-2">
            <BellRing className="w-7 h-7 text-[#C84B31]" /> Modèles de notifications
          </h1>
          <p className="text-sm text-[#6C6C6C] mt-1 max-w-3xl">
            Personnalisez les notifications envoyées dans l'application et sur WhatsApp. Les messages WhatsApp acceptent le formatage : <span className="font-mono">*gras*</span>, <span className="font-mono">_italique_</span>, <span className="font-mono">~barré~</span>, <span className="font-mono">```code```</span>.
          </p>
        </div>
      </div>

      <div className="card-flat p-4 text-xs text-[#6C6C6C] space-y-1">
        <div>
          Variables disponibles : <span className="font-mono">{'{actor_name}'}</span>, <span className="font-mono">{'{title}'}</span>, <span className="font-mono">{'{body}'}</span>, <span className="font-mono">{'{whatsapp_text}'}</span>, <span className="font-mono">{'{link}'}</span>.
        </div>
        <div>Chaque carte précise qui reçoit la notification et à quel moment elle part.</div>
      </div>

      {loading && <div className="text-sm text-[#6C6C6C]">Chargement...</div>}

      <div className="space-y-4">
        {templates.map((tpl) => (
          <div key={tpl.key} className="card-flat p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-2">
                <div className="font-['Manrope'] font-bold text-lg text-[#2D2D2D]">{tpl.label}</div>
                <div className="text-xs text-[#6C6C6C] font-mono">{tpl.key}</div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF5F2] px-2.5 py-1 text-[11px] font-semibold text-[#1F4E3D]">
                    <Users className="w-3.5 h-3.5" />
                    {tpl.audience || "Audience non précisée"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF3E8] px-2.5 py-1 text-[11px] font-semibold text-[#C84B31]">
                    <Clock3 className="w-3.5 h-3.5" />
                    {tpl.trigger || "Moment non précisé"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6C6C6C]">{tpl.enabled === false ? "Désactivé" : "Actif"}</span>
                <Switch checked={tpl.enabled !== false} onCheckedChange={(v) => updateTemplate(tpl.key, { enabled: v })} />
              </div>
            </div>

            <div className="grid xl:grid-cols-[1fr_1fr] gap-4">
              <div className="space-y-4">
                <label className="text-xs font-bold text-[#2D2D2D] block">
                  Titre application
                  <Input value={tpl.title_template || ""} onChange={(e) => updateTemplate(tpl.key, { title_template: e.target.value })} className="mt-1" />
                </label>
                <WhatsAppEditor label="Message application" value={tpl.body_template || ""} onChange={(value) => updateTemplate(tpl.key, { body_template: value })} rows={5} />
              </div>
              <WhatsAppEditor label="Message WhatsApp" value={tpl.whatsapp_template || ""} onChange={(value) => updateTemplate(tpl.key, { whatsapp_template: value })} rows={8} />
            </div>

            <Button type="button" onClick={() => saveTemplate(tpl)} disabled={savingKey === tpl.key} className="bg-[#1F4E3D] hover:bg-[#163328] text-white rounded-full">
              {savingKey === tpl.key ? <ToggleLeft className="w-4 h-4 mr-2 animate-pulse" /> : <Save className="w-4 h-4 mr-2" />}
              {savingKey === tpl.key ? "Enregistrement..." : "Enregistrer ce modèle"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
