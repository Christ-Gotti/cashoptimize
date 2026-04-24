"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "cashoptimize-cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: "accepted", date: new Date().toISOString() }));
    setVisible(false);
  }

  function refuse() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: "refused", date: new Date().toISOString() }));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 20,
      left: 20,
      right: 20,
      maxWidth: 520,
      margin: "0 auto",
      padding: 20,
      background: "white",
      borderRadius: 16,
      boxShadow: "0 10px 40px rgba(15,23,42,0.15)",
      border: "1px solid #e2e8f0",
      zIndex: 9999,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ fontSize: 24, flexShrink: 0 }}>🍪</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
            Cookies & vie privée
          </div>
          <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, margin: 0 }}>
            On utilise uniquement des cookies essentiels à l&apos;authentification et au bon fonctionnement de l&apos;app. Pas de tracking publicitaire, pas de revente de données.{" "}
            <Link href="/legal/privacy" style={{ color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>En savoir plus</Link>
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
        <button
          onClick={refuse}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            background: "white",
            color: "#475569",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >Refuser</button>
        <button
          onClick={accept}
          style={{
            padding: "8px 16px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)",
            color: "white",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >Accepter</button>
      </div>
    </div>
  );
}