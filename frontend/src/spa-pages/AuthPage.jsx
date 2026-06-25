import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Store, GraduationCap, ArrowRight, Phone, Lock, MessageCircle, ShieldCheck, Smartphone, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AuthPage() {
  const [params] = useSearchParams();
  const initialRole = params.get("role") === "assistant" ? "assistant" : "merchant";
  const [tab, setTab] = useState("login");

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col">
      <header className="border-b border-[#EAE5D9] bg-white">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="home-link">
            <div className="w-9 h-9 rounded-xl bg-[#C84B31] text-white grid place-items-center font-bold font-['Manrope']">
              K
            </div>
            <span className="font-['Manrope'] font-extrabold text-lg">Kaba-Compta</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto px-4 py-8">
        <div className="card-flat p-6">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login" data-testid="tab-login">Se connecter</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">Créer un compte</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <LoginForm />
            </TabsContent>

            <TabsContent value="register" className="mt-6">
              <RegisterForm initialRole={initialRole} onDone={() => setTab("login")} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function LoginForm() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [method, setMethod] = useState("totp");
  const [code, setCode] = useState("");
  const [devOtpCode, setDevOtpCode] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const finishLogin = (token, user) => {
    login(token, user);
    toast.success(`Bienvenue ${user.display_name}`);
    const redirectTo = searchParams.get("redirect");
    if (redirectTo) {
      navigate(redirectTo);
    } else if (user.role === "admin") {
      navigate("/admin/dashboard");
    } else {
      navigate(user.role === "assistant" ? "/app/assistant" : "/app/dashboard");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.post("/auth/login", { phone, password });
      if (r.data.requires_2fa) {
        const nextMethod = r.data.methods?.[0] || "totp";
        setChallenge(r.data);
        setMethod(nextMethod);
        setCode("");
        setDevOtpCode(r.data.dev_otp_code || "");
        toast.info(
          r.data.dev_otp_code && nextMethod === "whatsapp_otp"
            ? `Mode développement : Votre code est ${r.data.dev_otp_code}`
            : nextMethod === "whatsapp_otp"
              ? "Code envoyé sur WhatsApp"
              : "Entrez le code de votre application d'authentification",
        );
        return;
      }
      finishLogin(r.data.token, r.data.user);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const verifyChallenge = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.post("/auth/login/verify", {
        challenge_id: challenge.challenge_id,
        method,
        code,
      });
      finishLogin(r.data.token, r.data.user);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Code incorrect");
    } finally {
      setLoading(false);
    }
  };

  if (challenge) {
    const methods = challenge.methods || [];
    return (
      <form onSubmit={verifyChallenge} className="space-y-4" data-testid="login-2fa-form">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-10 h-10 text-[#1F4E3D]" />
          <div>
            <h1 className="font-['Manrope'] font-bold text-2xl">Vérification de sécurité</h1>
            <p className="text-sm text-[#6C6C6C]">Un code est nécessaire pour terminer la connexion.</p>
          </div>
        </div>

        {methods.length > 1 && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMethod("totp")} className={`rounded-xl border px-3 py-3 text-sm font-bold ${method === "totp" ? "border-[#1F4E3D] bg-[#1F4E3D] text-white" : "border-[#EAE5D9] bg-white text-[#2D2D2D]"}`}>
              <ShieldCheck className="w-4 h-4 inline mr-1" /> Application
            </button>
            <button type="button" onClick={() => setMethod("whatsapp_otp")} className={`rounded-xl border px-3 py-3 text-sm font-bold ${method === "whatsapp_otp" ? "border-[#1F4E3D] bg-[#1F4E3D] text-white" : "border-[#EAE5D9] bg-white text-[#2D2D2D]"}`}>
              <Smartphone className="w-4 h-4 inline mr-1" /> WhatsApp
            </button>
          </div>
        )}

        <div className="rounded-xl border border-[#EAE5D9] bg-white p-3 text-sm text-[#6C6C6C]">
          {method === "whatsapp_otp"
            ? "Saisissez le code reçu sur WhatsApp."
            : "Ouvrez votre application d'authentification et saisissez le code à 6 chiffres."}
        </div>

        {devOtpCode && method === "whatsapp_otp" && (
          <div className="rounded-xl border border-[#C84B31] bg-[#C84B31]/10 p-3 text-sm text-[#A83E28]">
            <strong>Mode développement :</strong> Votre code est <span className="font-mono font-bold">{devOtpCode}</span>
          </div>
        )}


        <div className="space-y-1.5">
          <Label htmlFor="login-2fa-code">Code <span className="text-[#C84B31]">*</span></Label>
          <Input
            id="login-2fa-code"
            data-testid="login-2fa-code-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            className="h-12 text-center font-mono text-xl tracking-widest"
            required
          />
        </div>

        <Button type="submit" disabled={loading} data-testid="login-2fa-submit-btn" className="w-full h-12 bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-xl">
          {loading ? "Vérification..." : "Valider et accéder"} <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
        <button
          type="button"
          onClick={() => {
            setChallenge(null);
            setDevOtpCode("");
          }}
          className="w-full text-sm text-[#6C6C6C] hover:text-[#C84B31] py-2"
        >
          Revenir à la connexion
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="login-form">
      <h1 className="font-['Manrope'] font-bold text-2xl">Ravi de vous revoir</h1>
      <p className="text-sm text-[#6C6C6C]">Entrez votre numéro et votre mot de passe.</p>

      <div className="space-y-1.5">
        <Label htmlFor="phone-login">Numéro de téléphone <span className="text-[#C84B31]">*</span></Label>
        <div className="relative">
          <Phone className="w-4 h-4 absolute left-3 top-3.5 text-[#6C6C6C]" />
          <Input
            id="phone-login"
            data-testid="login-phone-input"
            placeholder="90 00 00 00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="pl-9 h-12"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password-login">Mot de passe <span className="text-[#C84B31]">*</span></Label>
        <div className="relative">
          <Lock className="w-4 h-4 absolute left-3 top-3.5 text-[#6C6C6C]" />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-3 text-[#6C6C6C] hover:text-[#2D2D2D] transition-colors"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={showPassword}
            data-testid="login-password-toggle"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <Input
            id="password-login"
            data-testid="login-password-input"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-9 pr-10 h-12"
            required
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        data-testid="login-submit-btn"
        className="w-full h-12 bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-xl"
      >
        {loading ? "Connexion..." : "Se connecter"} <ArrowRight className="ml-2 w-4 h-4" />
      </Button>
    </form>
  );
}

function RegisterForm({ initialRole, onDone }) {
  const [step, setStep] = useState(1); // 1: form, 2: otp
  const [role, setRole] = useState(initialRole);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("Lomé");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [devOtpCode, setDevOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const submitForm = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.post("/auth/register", {
        phone,
        password,
        role,
        display_name: displayName,
        shop_name: role === "merchant" ? shopName : null,
        email: email || null,
        city,
      });
      const otpRes = await api.post("/auth/otp/send", { phone });
      login(r.data.token, r.data.user);
      setOtpError("");
      setDevOtpCode(otpRes.data?.dev_otp_code || "");
      setStep(2);
      toast.success(
        otpRes.data?.dev_otp_code
          ? `Mode développement : Votre code est ${otpRes.data.dev_otp_code}`
          : "Compte créé. Vérifiez votre numéro via WhatsApp.",
      );
    } catch (err) {
      const message = err?.response?.data?.detail || "Erreur d'inscription";
      setOtpError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/otp/verify", { phone, code: otp });
      toast.success("Numéro vérifié ! Bienvenue sur Kaba-Compta.");
      const redirectTo = searchParams.get("redirect");
      if (redirectTo) {
        navigate(redirectTo);
      } else {
        navigate(role === "assistant" ? "/app/assistant" : "/app/dashboard");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Code incorrect");
    } finally {
      setLoading(false);
    }
  };

  const skipOtp = () => {
    const redirectTo = searchParams.get("redirect");
    if (redirectTo) {
      navigate(redirectTo);
    } else {
      navigate(role === "assistant" ? "/app/assistant" : "/app/dashboard");
    }
  };

  if (step === 2) {
    return (
      <form onSubmit={verify} className="space-y-4" data-testid="otp-form">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-10 h-10 text-[#1F4E3D]" />
          <div>
            <h1 className="font-['Manrope'] font-bold text-xl">Vérification</h1>
            <p className="text-sm text-[#6C6C6C]">
              {devOtpCode ? "Mode développement activé." : "Un code à 6 chiffres a été envoyé sur WhatsApp."}
            </p>
          </div>
        </div>

        {devOtpCode && (
          <div className="rounded-xl border border-[#C84B31] bg-[#C84B31]/10 p-3 text-sm text-[#A83E28]">
            <strong>Mode développement :</strong> Votre code est <span className="font-mono font-bold">{devOtpCode}</span>
          </div>
        )}

        {otpError && (
          <div className="p-3 rounded-xl bg-[#C84B31]/10 border border-[#C84B31] text-sm text-[#A83E28]" data-testid="otp-send-error">
            {otpError}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="otp">Code à 6 chiffres <span className="text-[#C84B31]">*</span></Label>
          <Input
            id="otp"
            data-testid="otp-input"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            className="h-12 text-center font-mono text-xl tracking-widest"
            required
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          data-testid="otp-verify-btn"
          className="w-full h-12 bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-xl"
        >
          {loading ? "Vérification..." : "Valider le code"}
        </Button>

        <button
          type="button"
          onClick={skipOtp}
          className="w-full text-sm text-[#6C6C6C] hover:text-[#C84B31] py-2"
          data-testid="skip-otp-btn"
        >
          Plus tard (continuer vers l'application)
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitForm} className="space-y-4" data-testid="register-form">
      <h1 className="font-['Manrope'] font-bold text-2xl">Créer mon compte</h1>

      <div>
        <Label>Vous êtes</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            type="button"
            onClick={() => setRole("merchant")}
            data-testid="role-merchant-btn"
            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition ${
              role === "merchant" ? "border-[#C84B31] bg-[#C84B31]/5" : "border-[#EAE5D9] bg-white"
            }`}
          >
            <Store className="w-5 h-5 text-[#C84B31]" />
            <span className="text-sm font-semibold text-left">Commerçant(e)</span>
          </button>
          <button
            type="button"
            onClick={() => setRole("assistant")}
            data-testid="role-assistant-btn"
            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition ${
              role === "assistant" ? "border-[#1F4E3D] bg-[#1F4E3D]/5" : "border-[#EAE5D9] bg-white"
            }`}
          >
            <GraduationCap className="w-5 h-5 text-[#1F4E3D]" />
            <span className="text-sm font-semibold text-left">Comptable Licence</span>
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone-reg">Téléphone (T-Money / Moov Money) <span className="text-[#C84B31]">*</span></Label>
        <Input
          id="phone-reg"
          data-testid="register-phone-input"
          placeholder="90 00 00 00"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-12"
          required
        />
      </div>


      <div className="space-y-1.5">
        <Label htmlFor="email-reg">Adresse email</Label>
        <Input
          id="email-reg"
          data-testid="register-email-input"
          type="email"
          placeholder="vous@exemple.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name-reg">{role === "merchant" ? "Votre prénom / pseudo" : "Votre nom complet"} <span className="text-[#C84B31]">*</span></Label>
        <Input
          id="name-reg"
          data-testid="register-name-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="h-12"
          required
        />
      </div>

      {role === "merchant" && (
        <div className="space-y-1.5">
          <Label htmlFor="shop-reg">Nom de votre boutique / activité <span className="text-[#C84B31]">*</span></Label>
          <Input
            id="shop-reg"
            data-testid="register-shop-input"
            placeholder="Boutique Mama Aya"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="h-12"
            required
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="city-reg">Ville</Label>
        <Input
          id="city-reg"
          data-testid="register-city-input"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="h-12"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pwd-reg">Mot de passe <span className="text-[#C84B31]">*</span></Label>
        <div className="relative">
          <Lock className="w-4 h-4 absolute left-3 top-3.5 text-[#6C6C6C]" />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-3 text-[#6C6C6C] hover:text-[#2D2D2D] transition-colors"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={showPassword}
            data-testid="register-password-toggle"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <Input
            id="pwd-reg"
            data-testid="register-password-input"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={4}
            className="pl-9 pr-10 h-12"
            required
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        data-testid="register-submit-btn"
        className="w-full h-12 bg-[#C84B31] hover:bg-[#A83E28] text-white rounded-xl"
      >
        {loading ? "Création..." : "Créer mon compte"} <ArrowRight className="ml-2 w-4 h-4" />
      </Button>

      <p className="text-xs text-[#6C6C6C] text-center leading-relaxed">
        Aucune information n'est partagée avec l'OTR ou les autorités. Vos données restent privées.
      </p>
    </form>
  );
}
