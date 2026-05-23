import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Crown, Ban, CheckCircle2, Search, LogIn, Eye, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState("all");
  const [q, setQ] = useState("");
  const { startImpersonation } = useAuth();
  const navigate = useNavigate();


  const load = async () => {
    const params = {};
    if (role !== "all") params.role = role;
    if (q) params.q = q;
    const r = await api.get("/admin/users", { params });
    setUsers(r.data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [role]);

  const toggleBan = async (u) => {
    await api.put(`/admin/users/${u.id}`, { banned: !u.banned });
    toast.success(u.banned ? "Débanni" : "Banni");
    load();
  };
  const togglePremium = async (u) => {
    await api.put(`/admin/users/${u.id}`, { is_premium: !u.is_premium });
    toast.success("Mis à jour");
    load();
  };

  const impersonate = async (u) => {
    try {
      const r = await api.post(`/admin/users/${u.id}/impersonate`);
      startImpersonation(r.data.token, r.data.user);
      toast.success(`Connecté en tant que ${u.display_name}`);
      if (u.role === "assistant") navigate("/app/assistant");
      else navigate("/app/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };


  const deleteUser = async (u) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'utilisateur "${u.display_name}" ? Cette action effacera également toutes ses données liées (missions, offres, messages, etc.) de manière irréversible.`)) {
      return;
    }
    try {
      await api.delete(`/admin/users/${u.id}`);
      toast.success("Utilisateur supprimé avec succès");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de la suppression");
    }
  };

  return (
    <div className="space-y-4" data-testid="admin-users-page">
      <div>
        <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Console admin</p>
        <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1">Utilisateurs</h1>
      </div>

      <div className="card-flat p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#6C6C6C]" />
            <Input
              data-testid="admin-users-search"
              placeholder="Rechercher (nom, boutique, téléphone)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              className="pl-9 h-10"
            />
          </div>
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-44 h-10" data-testid="admin-role-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            <SelectItem value="merchant">Commerçants</SelectItem>
            <SelectItem value="assistant">Assistants</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="card-flat divide-y divide-[#EAE5D9]">
        {users.length === 0 && <div className="p-6 text-center text-[#6C6C6C]">Aucun utilisateur.</div>}
        {users.map((u) => (
          <div key={u.id} className="p-3 flex items-center gap-3" data-testid={`admin-user-${u.id}`}>
            <div className={`w-10 h-10 rounded-full grid place-items-center font-bold shrink-0 ${
              u.role === "admin" ? "bg-[#1F4E3D] text-white" :
              u.role === "merchant" ? "bg-[#C84B31] text-white" : "bg-[#ECA869] text-[#2D2D2D]"
            }`}>
              {u.display_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-['Manrope'] font-bold flex items-center gap-1.5 flex-wrap">
                {u.display_name}
                {u.is_premium && <Crown className="w-3.5 h-3.5 text-[#ECA869]" />}
                {u.banned && <span className="text-xs text-[#C84B31] font-semibold">SUSPENDU</span>}
              </div>
              <div className="text-xs text-[#6C6C6C]">
                {u.phone} · <span className="capitalize">{u.role}</span>
                {u.shop_name ? ` · ${u.shop_name}` : ""}
                {u.role === "assistant" && ` · KYC: ${u.kyc_status}`}
              </div>
            </div>
            {u.role !== "admin" && (
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={`/admin/users/${u.id}`}
                  data-testid={`view-detail-${u.id}`}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#6C6C6C] text-[#2D2D2D] hover:bg-[#2D2D2D] hover:text-white flex items-center gap-1"
                  title="Voir la fiche complète"
                >
                  <Eye className="w-3 h-3" /> Fiche
                </Link>
                <button
                  onClick={() => impersonate(u)}
                  data-testid={`impersonate-${u.id}`}
                  disabled={u.banned}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#1F4E3D] bg-[#1F4E3D] text-white hover:bg-[#163328] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Se connecter en tant que cet utilisateur"
                >
                  <LogIn className="w-3 h-3" /> Connexion
                </button>

                {u.role === "assistant" && (
                  <button onClick={() => togglePremium(u)} data-testid={`toggle-premium-${u.id}`} className="text-xs px-3 py-1.5 rounded-full border border-[#ECA869] text-[#ECA869] hover:bg-[#ECA869] hover:text-white">
                    {u.is_premium ? "Retirer Premium" : "Donner Premium"}
                  </button>
                )}
                <button onClick={() => toggleBan(u)} data-testid={`toggle-ban-${u.id}`} className={`text-xs px-3 py-1.5 rounded-full border ${u.banned ? "border-[#1F4E3D] text-[#1F4E3D] hover:bg-[#1F4E3D] hover:text-white" : "border-[#C84B31] text-[#C84B31] hover:bg-[#C84B31] hover:text-white"}`}>
                  {u.banned ? <><CheckCircle2 className="w-3 h-3 inline mr-1"/>Débannir</> : <><Ban className="w-3 h-3 inline mr-1"/>Suspendre</>}
                </button>
                <button
                  onClick={() => deleteUser(u)}
                  data-testid={`delete-${u.id}`}
                  className="text-xs px-3 py-1.5 rounded-full border border-red-600 text-red-600 hover:bg-red-600 hover:text-white flex items-center gap-1"
                  title="Supprimer définitivement"
                >
                  <Trash2 className="w-3 h-3" /> Supprimer
                </button>
              </div>
            )}
          </div>
        ))}
      </div>


    </div>
  );
}
