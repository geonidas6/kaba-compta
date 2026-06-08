import ClientCatchAll from "./ClientCatchAll";

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kaba-compta.it-sefako.com";

async function loadMeta(path) {
  try {
    const res = await fetch(`${API_URL}/api/public/meta?path=${encodeURIComponent(path)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return {
      title: "Kaba-Compta Togo",
      description: "Plateforme de mise en relation comptable marchand au Togo.",
      url: `${SITE_URL}${path}`,
      image: `${SITE_URL}/kaba-compta-cover.svg`,
      type: "website",
    };
  }
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const parts = resolvedParams?.catchall || [];
  const path = parts.length ? `/${parts.join("/")}` : "/";
  const meta = await loadMeta(path);
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.url },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: meta.url,
      siteName: "Kaba-Compta",
      type: meta.type || "website",
      images: meta.image ? [{ url: meta.image, width: 1200, height: 630 }] : [],
      locale: "fr_TG",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: meta.image ? [meta.image] : [],
    },
  };
}

export default function CatchAll() {
  return <ClientCatchAll />;
}
