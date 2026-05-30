import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Briefcase,
  MessageCircle,
  Bell,
  User as UserIcon,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import ImpersonationBanner from "@/components/ImpersonationBanner";

const merchantTabs = [
  { to: "/app/dashboard", icon: LayoutDashboard, label: "Accueil" },
  { to: "/app/forum", icon: MessageSquare, label: "Forum" },
  { to: "/app/missions", icon: Briefcase, label: "Missions" },
  { to: "/app/messages", icon: MessageCircle, label: "Messages" },
  { to: "/app/profile", icon: UserIcon, label: "Moi" },
];

const assistantTabs = [
  { to: "/app/assistant", icon: LayoutDashboard, label: "Accueil" },
  { to: "/app/forum", icon: MessageSquare, label: "Forum" },
  { to: "/app/missions", icon: Briefcase, label: "Missions" },
  { to: "/app/messages", icon: MessageCircle, label: "Messages" },
  { to: "/app/profile", icon: UserIcon, label: "Moi" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const tabs = user?.role === "assistant" ? assistantTabs : merchantTabs;
  const roleLabel = user?.role === "merchant" ? "Marchand" : user?.role === "assistant" ? "Comptable" : "";
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let timer;
    const loadUnread = async () => {
      try {
        const r = await api.get("/notifications/unread-count");
        setUnreadCount(Number(r.data?.count || 0));
      } catch {
        setUnreadCount(0);
      }
    };
    loadUnread();
    timer = setInterval(loadUnread, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5]">
      <ImpersonationBanner />
      <header
        className="sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur border-b border-[#EAE5D9]"
        data-testid="app-header"
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div onClick={() => navigate("/")} className="flex items-center gap-2 cursor-pointer select-none" title="Aller à la page d'accueil">
            <div className="w-9 h-9 rounded-xl bg-[#C84B31] text-white grid place-items-center font-bold font-['Manrope']">K</div>
            <div>
              <div className="font-['Manrope'] font-bold text-[#2D2D2D] leading-none">Kaba-Compta</div>
              <div className="text-xs text-[#6C6C6C] leading-tight">{user?.shop_name || user?.display_name} · {roleLabel}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate("/app/notifications")}
              data-testid="notifications-btn"
              className="relative flex items-center justify-center text-[#6C6C6C] hover:text-[#C84B31] py-2 px-2.5 rounded-lg"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#C84B31] text-white text-[10px] leading-[16px] text-center font-bold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>
            <button
              onClick={handleLogout}
              data-testid="logout-btn"
              className="flex items-center gap-1.5 text-[#6C6C6C] hover:text-[#C84B31] text-sm py-2 px-3 rounded-lg"
            >
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Quitter</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4 pb-28">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-[#EAE5D9] safe-bottom" data-testid="bottom-nav">
        <div className="max-w-5xl mx-auto grid grid-cols-5 px-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              data-testid={`nav-${t.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium ${
                  isActive ? "text-[#C84B31]" : "text-[#6C6C6C]"
                }`
              }
            >
              <t.icon className="w-5 h-5" />
              <span>{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
