"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

let dodoReady = false;

async function ensureDodoInit() {
  if (dodoReady) return true;
  try {
    const mod = await import("dodopayments-checkout");
    const DP = (mod as unknown as { DodoPayments: { Initialize: (o: object) => void; Checkout: { open: (o: { checkoutUrl: string }) => void } } }).DodoPayments;
    DP.Initialize({
      mode: "live",
      displayType: "overlay",
      onEvent: (event: { type: string }) => {
        console.log("[Dodo event]", event);
        if (event.type === "checkout.redirect" || event.type === "payment_success") {
          window.location.href = "/dashboard?subscription=success";
        }
      },
    });
    dodoReady = true;
    return true;
  } catch (err) {
    console.warn("[Dodo] Init failed:", err);
    return false;
  }
}

export function CheckoutButton({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Charge la session initiale
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      console.log("[CheckoutButton] Initial session:", !!data.session);
    });
    // Écoute les changements (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    // Init Dodo en parallèle
    ensureDodoInit();
    return () => subscription.unsubscribe();
  }, []);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      // Si pas de session → signup
      if (!session?.access_token) {
        console.log("[CheckoutButton] No session, going to /signup");
        router.push("/signup");
        return;
      }

      const res = await fetch("/api/dodo/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.status === 401) {
        router.push("/signup");
        return;
      }

      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erreur checkout");

      if (body.checkoutUrl) {
        const initialized = await ensureDodoInit();
        if (initialized) {
          const mod = await import("dodopayments-checkout");
          const DP = (mod as unknown as { DodoPayments: { Checkout: { open: (o: { checkoutUrl: string }) => void } } }).DodoPayments;
          DP.Checkout.open({ checkoutUrl: body.checkoutUrl });
          setLoading(false);
        } else {
          // Fallback redirect
          window.location.href = body.checkoutUrl;
        }
      }
    } catch (e) {
      console.error("[CheckoutButton]", e);
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{ ...style, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1, border: "none", font: "inherit" }}
      >
        {loading ? "Chargement…" : children}
      </button>
      {error && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontSize: 12 }}>
          {error}
        </div>
      )}
    </>
  );
}