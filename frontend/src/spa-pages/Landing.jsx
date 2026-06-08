import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Briefcase,
  Smartphone,
  CheckCircle2,
  ArrowRight,
  Users,
  GraduationCap,
  MessageSquare,
  Sparkles,
  HelpCircle,
  Award,
  Coins,
  MapPin,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function Landing() {
  const [data, setData] = useState({
    freelance_count: 0,
    merchant_count: 0,
    question_count: 0,
    latest_missions: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/public/landing-data")
      .then((r) => {
        setData(r.data);
      })
      .catch((e) => {
        console.error("Erreur de chargement des stats", e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D2D2D]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur border-b border-[#EAE5D9]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 select-none" title="Kaba-Compta">
            <div className="w-9 h-9 rounded-xl bg-[#C84B31] text-white grid place-items-center font-bold font-['Manrope']">
              K
            </div>
            <span className="font-['Manrope'] font-extrabold text-lg">Kaba-Compta</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/auth" data-testid="header-login-link">
              <Button
                className="bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-full px-5"
                data-testid="header-login-btn"
              >
                Se connecter
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-texture py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white border border-[#EAE5D9] px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-[#1F4E3D]">
              <ShieldCheck className="w-3.5 h-3.5" /> Entraide & Mise en relation
            </div>
            <h1 className="font-['Manrope'] font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-tight mt-5">
              Votre comptabilité simplifiée par la <span className="brand-gradient-text">communauté</span>.
            </h1>
            <p className="mt-5 text-lg text-[#2D2D2D]/80 leading-relaxed max-w-lg">
              Posez vos questions gratuitement sur notre forum pour obtenir des conseils, ou recrutez un jeune diplômé en Licence comptabilité pour vos bilans et inventaires.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/auth?role=merchant" data-testid="hero-cta-merchant">
                <Button
                  size="lg"
                  className="bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-full px-6 h-12"
                >
                  Je suis commerçant <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link to="/auth?role=assistant" data-testid="hero-cta-assistant">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#1F4E3D] text-[#1F4E3D] hover:bg-[#1F4E3D] hover:text-white rounded-full px-6 h-12"
                >
                  Je suis comptable Licence
                </Button>
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-4 text-sm text-[#6C6C6C]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#1F4E3D]" /> Forum gratuit
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#1F4E3D]" /> Profils vérifiés
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#1F4E3D]" /> Sans engagement
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -m-3 bg-[#ECA869]/30 rounded-3xl rotate-2" />
            <img
              src="https://images.unsplash.com/photo-1734255026082-82fdc81991f0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzl8MHwxfHNlYXJjaHwzfHxhZnJpY2FuJTIwbWFya2V0JTIwdHJhZGVyfGVufDB8fHx8MTc3OTA5MDEyN3ww&ixlib=rb-4.1.0&q=85"
              alt="Commerçante au marché"
              className="relative rounded-2xl shadow-sm border border-[#EAE5D9] w-full object-cover aspect-[4/5]"
              data-testid="hero-image"
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="-mt-8 relative z-20 max-w-5xl mx-auto px-4 mb-8">
        <div className="bg-white rounded-2xl border border-[#EAE5D9] shadow-sm p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#EAE5D9]">
            
            <div className="flex items-center gap-4 py-4 sm:py-0 justify-center">
              <div className="w-12 h-12 rounded-xl bg-[#1F4E3D]/10 text-[#1F4E3D] grid place-items-center shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <div className="font-['Manrope'] font-extrabold text-3xl text-[#1F4E3D]">
                  {loading ? "..." : data.freelance_count}
                </div>
                <div className="text-xs text-[#6C6C6C] font-semibold uppercase tracking-wider mt-0.5">
                  Comptables
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 py-4 sm:py-0 sm:pl-8 justify-center">
              <div className="w-12 h-12 rounded-xl bg-[#C84B31]/10 text-[#C84B31] grid place-items-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="font-['Manrope'] font-extrabold text-3xl text-[#C84B31]">
                  {loading ? "..." : data.merchant_count}
                </div>
                <div className="text-xs text-[#6C6C6C] font-semibold uppercase tracking-wider mt-0.5">
                  Marchands inscrits
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 py-4 sm:py-0 sm:pl-8 justify-center">
              <div className="w-12 h-12 rounded-xl bg-[#ECA869]/20 text-[#C84B31] grid place-items-center shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <div className="font-['Manrope'] font-extrabold text-3xl text-[#2D2D2D]">
                  {loading ? "..." : data.question_count}
                </div>
                <div className="text-xs text-[#6C6C6C] font-semibold uppercase tracking-wider mt-0.5">
                  Questions forum
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Forum Highlight section */}
      <section className="py-16 bg-[#FDFCFB] border-y border-[#EAE5D9]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="order-2 md:order-1 space-y-4">
              <div className="p-4 bg-[#FAF8F5] border border-[#EAE5D9] rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C84B31]"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6C6C6C]">Fiscalité OTR</span>
                </div>
                <div className="font-['Manrope'] font-bold text-[#2D2D2D]">
                  "Comment déclarer la taxe professionnelle unique (TPU) à Lomé ?"
                </div>
                <div className="text-xs text-[#6C6C6C] flex items-center gap-2">
                  <span>Assistant K. Koffi :</span>
                  <span className="text-[#1F4E3D] font-semibold">"La TPU dépend de votre chiffre d'affaires annuel. Voici le calcul..."</span>
                </div>
              </div>

              <div className="p-4 bg-[#FAF8F5] border border-[#EAE5D9] rounded-2xl space-y-3 opacity-90">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1F4E3D]"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6C6C6C]">Gestion quotidienne</span>
                </div>
                <div className="font-['Manrope'] font-bold text-[#2D2D2D]">
                  "Quelle est la meilleure méthode pour faire un inventaire de fin de mois ?"
                </div>
                <div className="text-xs text-[#6C6C6C] flex items-center gap-2">
                  <span>Assistant A. Mawuli :</span>
                  <span className="text-[#1F4E3D] font-semibold">"Je vous conseille la méthode du premier entré, premier sorti..."</span>
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 bg-[#ECA869]/20 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-[#C84B31]">
                <MessageSquare className="w-3.5 h-3.5" /> Le Forum Communautaire
              </div>
              <h2 className="font-['Manrope'] font-bold text-3xl sm:text-4xl mt-5">
                Des réponses gratuites à toutes vos questions comptables.
              </h2>
              <p className="mt-4 text-[#6C6C6C] leading-relaxed">
                Notre forum rassemble des commerçants togolais et des professionnels de la gestion. Posez vos questions de fiscalité (OTR), de caisse ou administratives, et recevez des conseils précis rédigés par des diplômés certifiés.
              </p>
              <div className="mt-6 space-y-4">
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#1F4E3D]/10 text-[#1F4E3D] grid place-items-center shrink-0 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold font-['Manrope'] text-[#2D2D2D]">Pour les commerçants</h4>
                    <p className="text-sm text-[#6C6C6C]">Obtenez des réponses gratuites et anonymes pour guider vos choix de gestion quotidienne sans débourser un franc.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#1F4E3D]/10 text-[#1F4E3D] grid place-items-center shrink-0 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold font-['Manrope'] text-[#2D2D2D]">Pour les comptables</h4>
                    <p className="text-sm text-[#6C6C6C]">Démontrez vos compétences en aidant la communauté pour attirer de nouveaux clients et décrocher des missions rémunérées.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Open Missions section */}
      <section className="py-16 bg-[#FAF8F5]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 bg-[#1F4E3D]/10 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-[#1F4E3D]">
              <Briefcase className="w-3.5 h-3.5" /> Offres de missions
            </div>
            <h2 className="font-['Manrope'] font-bold text-3xl sm:text-4xl mt-3">
              Dernières missions publiées encore ouvertes
            </h2>
            <p className="text-[#6C6C6C] mt-2">
              Postulez directement en créant un compte assistant certifié Licence sur Kaba-Compta.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-[#C84B31] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : data.latest_missions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-[#EAE5D9] p-6">
              <p className="text-sm text-[#6C6C6C] italic">Aucune mission ouverte pour le moment. Revenez plus tard !</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.latest_missions.map((m) => {
                const budgetText = m.budget_max_fcfa 
                  ? `${m.budget_min_fcfa ? m.budget_min_fcfa.toLocaleString("fr-FR") + " - " : ""}${m.budget_max_fcfa.toLocaleString("fr-FR")} FCFA`
                  : m.budget_min_fcfa ? `${m.budget_min_fcfa.toLocaleString("fr-FR")} FCFA` : "Sur devis";

                return (
                  <div key={m.id} className="bg-white rounded-2xl border border-[#EAE5D9] p-5 shadow-sm hover:shadow-md hover:border-[#1F4E3D]/50 transition flex flex-col justify-between h-full">
                    <div className="space-y-3">
                      {/* Top badge Row */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F4E3D] bg-[#1F4E3D]/10 px-2 py-0.5 rounded">
                          {m.type === "autre" ? "Micro-mission" : m.type}
                        </span>
                        <span className="text-[10px] text-[#6C6C6C] flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {new Date(m.created_at).toLocaleDateString("fr-FR")}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="font-['Manrope'] font-bold text-base text-[#2D2D2D] line-clamp-1">
                        {m.title}
                      </h4>

                      {/* Description */}
                      <p className="text-xs text-[#6C6C6C] leading-relaxed line-clamp-2">
                        {m.description}
                      </p>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-[#6C6C6C]">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#C84B31]" /> {m.merchant_city || "Lomé"}
                        </div>
                        <div className="flex items-center gap-1 font-semibold text-[#2D2D2D]">
                          <Coins className="w-3.5 h-3.5 text-[#ECA869]" /> {budgetText}
                        </div>
                        <div className="capitalize">
                          Contrat : <strong className="text-[#2D2D2D]">{m.contract_type}</strong>
                        </div>
                        <div className="capitalize">
                          Niveau : <strong className="text-[#2D2D2D]">{m.level}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="pt-5 border-t border-[#EAE5D9]/40 mt-4">
                      <Link to={`/auth?redirect=${encodeURIComponent(`/app/missions/${m.slug || m.id}`)}`} className="block w-full">
                        <Button className="w-full h-10 bg-[#1F4E3D] hover:bg-[#16372B] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                          Proposer mes services <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Why Section */}
      <section className="py-16 max-w-5xl mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold">
            Pourquoi Kaba-Compta
          </p>
          <h2 className="font-['Manrope'] font-bold text-3xl sm:text-4xl mt-3">
            La première plateforme d'entraide comptable au Togo.
          </h2>
          <p className="text-[#6C6C6C] mt-3">
            Kaba-Compta vous permet de trouver des solutions rapides à vos problématiques comptables, que ce soit par l'entraide gratuite ou par le recrutement d'assistants qualifiés.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-10">
          <Feature
            icon={MessageSquare}
            title="Forum d'entraide gratuit"
            desc="Posez vos questions sur la fiscalité OTR, les déclarations de TPU et la tenue de caisse."
          />
          <Feature
            icon={Briefcase}
            title="Recrutement d'assistants"
            desc="Publiez des micro-missions (inventaires, bilans, audits) et recevez des propositions chiffrées."
          />
          <Feature
            icon={GraduationCap}
            title="Jeunes diplômés vérifiés"
            desc="Nos assistants possèdent tous une Licence en Comptabilité et Gestion validée par notre service KYC."
          />
          <Feature
            icon={Award}
            title="Système de notation"
            desc="Consultez les évaluations et les avis rédigés par d'autres commerçants avant de recruter."
          />
          <Feature
            icon={ShieldCheck}
            title="Confidentialité totale"
            desc="Inscription simple avec votre numéro de téléphone. Aucun partage d'informations fiscales."
          />
          <Feature
            icon={Smartphone}
            title="Messagerie sécurisée"
            desc="Discutez en privé avec vos assistants pour planifier l'intervention et définir le tarif."
          />
        </div>
      </section>

      {/* For accountants */}
      <section className="py-16 bg-[#1F4E3D] text-white">
        <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center">
          <img
            src="https://images.unsplash.com/photo-1622556498246-755f44ca76f3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMGFmcmljYW4lMjBzdHVkZW50JTIwc21hcnRwaG9uZXxlbnwwfHx8fDE3NzkwOTAxMjd8MA&ixlib=rb-4.1.0&q=85"
            alt="Jeune diplômé"
            className="rounded-2xl w-full object-cover aspect-[4/5] border border-white/10"
            data-testid="assistant-image"
          />
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
              <GraduationCap className="w-3.5 h-3.5" /> Pour les diplômés en comptabilité
            </div>
            <h2 className="font-['Manrope'] font-bold text-3xl sm:text-4xl mt-5">
              Trouvez vos premiers clients et gagnez de l'expérience.
            </h2>
            <p className="mt-4 text-white/85 leading-relaxed">
              Vous venez de finir votre Licence et cherchez à vous lancer ? Rejoignez Kaba-Compta pour conseiller les commerçants sur le forum, vous faire remarquer et décrocher des micro-missions rémunérées à Lomé.
            </p>
            <ul className="mt-6 space-y-3 text-white/90">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#ECA869]" /> Obtention du badge "Comptable certifié Licence" après vérification KYC
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#ECA869]" /> Visibilité accrue auprès des commerçants en répondant sur le forum
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#ECA869]" /> Formule Premium optionnelle pour apparaître en tête de liste
              </li>
            </ul>
            <Link to="/auth?role=assistant" className="inline-block mt-7">
              <Button
                size="lg"
                className="bg-[#ECA869] hover:bg-[#d99151] text-[#1F4E3D] font-bold rounded-full px-6 h-12"
                data-testid="footer-cta-assistant"
              >
                Créer mon profil <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 max-w-5xl mx-auto px-4">
        <p className="uppercase text-xs tracking-widest text-[#1F4E3D] font-bold text-center">
          Comment ça marche
        </p>
        <h2 className="font-['Manrope'] font-bold text-3xl sm:text-4xl mt-3 text-center">
          3 étapes simples pour démarrer.
        </h2>
        <div className="grid md:grid-cols-3 gap-4 mt-10">
          <Step n="1" title="Je m'inscris" desc="Mon numéro de téléphone suffit. Pas de formalités administratives." />
          <Step n="2" title="J'utilise le forum" desc="Je pose mes questions gratuitement ou j'y réponds pour démontrer mon savoir-faire." />
          <Step n="3" title="Je recrute ou je postule" desc="Je publie une mission de gestion (inventaire, caisse...) ou je propose mes services d'assistant." />
        </div>
      </section>

      <footer className="border-t border-[#EAE5D9] py-8 text-center text-sm text-[#6C6C6C]">
        Kaba-Compta Togo — Plateforme communautaire d'entraide et de mise en relation comptable.
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }) {
  return (
    <div className="card-flat p-5">
      <div className="w-10 h-10 rounded-lg bg-[#C84B31]/10 text-[#C84B31] grid place-items-center mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <div className="font-['Manrope'] font-bold text-lg">{title}</div>
      <div className="text-sm text-[#6C6C6C] mt-1.5 leading-relaxed">{desc}</div>
    </div>
  );
}

function Step({ n, title, desc }) {
  return (
    <div className="card-flat p-6">
      <div className="font-['Manrope'] text-5xl font-extrabold text-[#ECA869]">
        {n}
      </div>
      <div className="font-['Manrope'] font-bold text-xl mt-3">{title}</div>
      <div className="text-sm text-[#6C6C6C] mt-2 leading-relaxed">{desc}</div>
    </div>
  );
}
