import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Briefcase,
  Settings,
  LogOut,
  Shield,
  ListChecks,
  Megaphone,
  Flag,
  Menu,
  X,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const tabs = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
  { to: "/admin/users", icon: Users, label: "Utilisateurs" },
  { to: "/admin/kyc", icon: ShieldCheck, label: "Vérifications KYC" },
  { to: "/admin/missions", icon: Briefcase, label: "Missions" },
  { to: "/admin/forum-reports", icon: MessageSquare, label: "Gestion du Forum" },
  { to: "/admin/broadcast", icon: Megaphone, label: "Diffusion WhatsApp" },
  { to: "/admin/audit", icon: ListChecks, label: "Journal d'audit" },
  { to: "/admin/settings", icon: Settings, label: "Paramètres" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5]" data-testid="admin-layout">
      {/* Mobile Top Bar */}
      <header className="lg:hidden bg-[#1F4E3D] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition"
          data-testid="admin-mobile-menu-btn"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-['Manrope'] font-bold text-sm tracking-wide">Console Admin</span>
        <div className="w-8"></div> {/* Spacer for visual balance */}
      </header>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:h-screen lg:overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-[#1F4E3D] text-white flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-full lg:w-[260px] ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
            <div onClick={() => navigate("/")} className="flex items-center gap-2 cursor-pointer select-none" title="Aller à la page d'accueil">
              <div className="w-10 h-10 rounded-xl bg-[#C84B31] grid place-items-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="font-['Manrope'] font-extrabold text-lg">Kaba-Compta</div>
                <div className="text-xs text-white/70">Console admin</div>
              </div>
            </div>
            {/* Mobile Sidebar Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-1.5 hover:bg-white/10 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-3 px-3">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                onClick={() => setIsOpen(false)}
                data-testid={`admin-nav-${t.label.toLowerCase().replace(/\s/g, "-")}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium mb-1 transition ${
                    isActive ? "bg-white/15" : "hover:bg-white/5 text-white/85"
                  }`
                }
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </NavLink>
            ))}
          </nav>

          <div className="px-3 py-3 border-t border-white/10">
            <div className="text-xs text-white/60 mb-2 px-2">Connecté en tant que</div>
            <div className="px-2 mb-3 text-sm font-semibold">{user?.display_name}</div>
            <button
              onClick={handleLogout}
              data-testid="admin-logout-btn"
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
            >
              <LogOut className="w-4 h-4" /> Déconnexion
            </button>
          </div>
        </aside>

        <main className="lg:col-start-2 px-4 lg:px-8 py-6 lg:py-8 w-full max-w-none lg:h-full lg:overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
