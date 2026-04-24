"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const INDUSTRIES = [
  "BTP / Construction", "Commerce / Retail", "Restauration / Food",
  "Conseil / Services pro", "Tech / SaaS", "Santé / Bien-être",
  "Artisanat", "Agence com / Marketing", "Immobilier", "Industrie", "Autre",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [siret, setSiret] = useState("");
  const [industry, setIndustry] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setChecking(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Le nom est obligatoire"); return; }
    setLoading(true); setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: name.trim(), siret: siret.trim() || undefined, industry: industry || undefined }),
    });

    const body = await res.json();
    if (!res.ok) { setError(body.error ?? "Erreur"); setLoading(false); return; }
    router.push("/pnl");
  }

  if (checking) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Chargement…</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Step label="Compte" done />
          <Line done />
          <Step label="Entreprise" active />
          <Line />
          <Step label="Connecter banque" />
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center text-2xl mb-4" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)" }}>🏢</div>
            <h1 className="text-2xl font-extrabold text-slate-900">Parle-nous de ton entreprise</h1>
            <p className="text-sm text-slate-500 mt-2">30 secondes, et on te balance sur ton tableau de bord.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nom de ton entreprise <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="ex: Dupont Bâtiment"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                SIRET <span className="font-normal text-slate-400 normal-case">(optionnel)</span>
              </label>
              <input
                type="text"
                placeholder="14 chiffres"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                maxLength={14}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Secteur <span className="font-normal text-slate-400 normal-case">(optionnel)</span>
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
              >
                <option value="">Choisir…</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm shadow-lg shadow-indigo-500/30 transition disabled:opacity-50 hover:shadow-xl hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)" }}
            >
              {loading ? "Création…" : "Créer mon espace →"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">🔒 Tes données sont chiffrées et hébergées en Europe.</p>
      </div>
    </div>
  );
}

function Step({ label, active, done }: { label: string; active?: boolean; done?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
        done ? "bg-emerald-500 text-white" :
        active ? "text-white" : "bg-slate-200 text-slate-400"
      }`} style={active ? { background: "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)" } : {}}>
        {done ? "✓" : active ? "●" : "○"}
      </div>
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${active || done ? "text-slate-900" : "text-slate-400"}`}>{label}</div>
    </div>
  );
}

function Line({ done }: { done?: boolean }) {
  return <div className={`flex-1 max-w-[60px] h-0.5 ${done ? "bg-emerald-500" : "bg-slate-200"} mt-3`} />;
}