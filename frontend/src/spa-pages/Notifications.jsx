import { useEffect, useState } from "react";
import { Bell, CheckCheck, Clock3 } from "lucide-react";
import { api } from "@/lib/api";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/notifications", { params: { limit: 100 } });
      setItems(r.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    await api.post("/notifications/read-all");
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <section className="space-y-4" data-testid="notifications-page">
      <div className="flex items-center justify-between">
        <div>
          <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Forum</p>
          <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1">Notifications</h1>
        </div>
        <button
          onClick={markAllRead}
          className="inline-flex items-center gap-2 rounded-full border border-[#EAE5D9] px-3 py-2 text-sm font-semibold text-[#1F4E3D]"
        >
          <CheckCheck className="w-4 h-4" /> Tout lire
        </button>
      </div>

      {loading ? (
        <div className="card-flat p-4 text-[#6C6C6C]">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="card-flat p-5 text-[#6C6C6C]">Aucune notification forum pour le moment.</div>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                if (!n.is_read) markRead(n.id);
                if (n.link) window.location.href = n.link;
              }}
              className={`w-full text-left card-flat p-4 ${n.is_read ? "" : "border-[#1F4E3D]/30 bg-[#F5FBF8]"}`}
            >
              <div className="flex items-start gap-3">
                <Bell className="w-4 h-4 mt-1 text-[#1F4E3D]" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#2D2D2D]">{n.title}</div>
                  <div className="text-sm text-[#4E4E4E] mt-1 break-words">{n.body}</div>
                  <div className="mt-2 text-xs text-[#7A7A7A] inline-flex items-center gap-1">
                    <Clock3 className="w-3.5 h-3.5" /> {new Date(n.created_at).toLocaleString("fr-FR")}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
