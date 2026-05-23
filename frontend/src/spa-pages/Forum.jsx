import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Plus, ArrowUp, MessageCircle, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

const SORTS = [
  { v: "recent", l: "Récents" },
  { v: "top", l: "Populaires" },
  { v: "unanswered", l: "Sans réponse" },
];

export default function Forum() {
  const [items, setItems] = useState([]);
  const [tags, setTags] = useState([]);
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("recent");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const params = { sort };
    if (tag) params.tag = tag;
    if (q) params.q = q;
    const r = await api.get("/forum/questions", { params });
    setItems(r.data);
    setLoading(false);
  };

  useEffect(() => {
    api.get("/forum/tags").then((r) => setTags(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [sort, tag]);

  return (
    <div className="space-y-5" data-testid="forum-page">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">Communauté</p>
          <h1 className="font-['Manrope'] font-extrabold text-3xl mt-1 flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-[#C84B31]" /> Forum
          </h1>
          <p className="text-sm text-[#6C6C6C] mt-1">
            Posez vos questions, partagez votre expérience comptable et commerçante.
          </p>
        </div>
        <Link to="/app/forum/new">
          <Button data-testid="new-question-btn" className="bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-full">
            <Plus className="w-4 h-4 mr-1" /> Question
          </Button>
        </Link>
      </div>

      <div className="card-flat p-3 flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-[#6C6C6C] absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Rechercher..."
            className="h-10 pl-9"
            data-testid="forum-search-input"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {SORTS.map((s) => (
            <button
              key={s.v}
              onClick={() => setSort(s.v)}
              data-testid={`forum-sort-${s.v}`}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                sort === s.v
                  ? "bg-[#1F4E3D] text-white border-[#1F4E3D]"
                  : "bg-white text-[#2D2D2D] border-[#EAE5D9]"
              }`}
            >
              {s.l}
            </button>
          ))}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap items-center" data-testid="forum-tags-bar">
          <Filter className="w-3.5 h-3.5 text-[#6C6C6C]" />
          {tag && (
            <button
              onClick={() => setTag("")}
              className="text-xs px-2.5 py-1 rounded-full bg-[#C84B31] text-white"
            >
              × {tag}
            </button>
          )}
          {tags.filter((t) => t.tag !== tag).slice(0, 12).map((t) => (
            <button
              key={t.tag}
              onClick={() => setTag(t.tag)}
              data-testid={`forum-tag-${t.tag}`}
              className="text-xs px-2.5 py-1 rounded-full bg-white border border-[#EAE5D9] text-[#6C6C6C] hover:border-[#C84B31]"
            >
              #{t.tag} <span className="text-[10px] opacity-60">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {loading && <div className="text-[#6C6C6C] text-sm">Chargement...</div>}

      {!loading && items.length === 0 && (
        <div className="card-flat p-8 text-center" data-testid="forum-empty">
          <MessageSquare className="w-10 h-10 text-[#6C6C6C] mx-auto" />
          <div className="mt-3 text-[#6C6C6C]">Aucune question. Soyez le premier à en poser une !</div>
        </div>
      )}

      <div className="space-y-2">
        {items.map((q) => (
          <Link
            to={`/app/forum/${q.id}`}
            key={q.id}
            className="block card-flat p-4 hover:border-[#C84B31] transition"
            data-testid={`question-${q.id}`}
          >
            <div className="flex gap-4">
              <div className="text-center min-w-[44px]">
                <div className="flex flex-col items-center text-[#1F4E3D]">
                  <ArrowUp className="w-4 h-4" />
                  <div className="font-['Manrope'] font-bold">{q.votes}</div>
                </div>
                <div className="mt-2 flex flex-col items-center text-[#6C6C6C]">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <div className="text-xs">{q.answers_count}</div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  {q.author_avatar ? (
                    <img src={q.author_avatar} alt={q.author_name} className="w-5 h-5 rounded-full object-cover border border-[#EAE5D9]" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-[#1F4E3D] text-white font-bold grid place-items-center text-[10px]">
                      {q.author_name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <span className="text-xs text-[#6C6C6C] flex items-center gap-1.5 flex-wrap">
                    <span>par <strong>{q.author_name}</strong></span>
                    {q.author_role === "assistant" && q.author_kyc_status === "approved" && (
                      <span className="inline-flex items-center gap-0.5 bg-[#1F4E3D] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-sm" title="Comptable Vérifié (KYC)">
                        Pro
                      </span>
                    )}
                    <span>({q.author_role === "merchant" ? "Marchand" : q.author_role === "assistant" ? "Comptable" : "Admin"})</span>
                  </span>
                </div>
                <div className="font-['Manrope'] font-bold text-base">{q.title}</div>
                <div className="text-sm text-[#2D2D2D]/80 mt-1 line-clamp-2">{q.body}</div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {(q.tags || []).map((t) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1F4E3D]/10 text-[#1F4E3D]">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
