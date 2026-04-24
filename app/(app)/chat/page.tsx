"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "J'embauche un développeur en juin à 3000€",
  "Mon loyer passe à 2200€ à partir de septembre",
  "J'ai signé un client récurrent à 1500€/mois pour 12 mois",
  "Je prends un emprunt de 50 000€ remboursable 1200€/mois sur 5 ans",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ message: text.trim(), conversationId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erreur");

      setConversationId(body.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: body.reply ?? "(pas de réponse)" }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div style={{ padding: 24, maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</span>
            Chat Trésorerie
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
            Parle à Claude en langage naturel pour mettre à jour tes prévisions. Exemple : &quot;j&apos;embauche en juin à 3000€&quot;.
          </p>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            minHeight: 300,
          }}
        >
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Dis à Claude ce qui change</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Il comprend et met à jour ton Prévu tout seul.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 500, margin: "0 auto" }}>
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    style={{
                      padding: "10px 14px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      fontSize: 13,
                      color: "#334155",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >💭 {s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "75%",
                padding: "10px 14px",
                borderRadius: 14,
                background: m.role === "user" ? GRADIENT : "#f1f5f9",
                color: m.role === "user" ? "white" : "#0f172a",
                fontSize: 14,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}>
                {m.content}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, textTransform: "uppercase", fontWeight: 600 }}>
                {m.role === "user" ? "Toi" : "Claude"}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ padding: "10px 14px", borderRadius: 14, background: "#f1f5f9", fontSize: 14 }}>
                <span style={{ display: "inline-block", animation: "pulse 1s infinite" }}>●</span>
                <span style={{ display: "inline-block", animation: "pulse 1s infinite 0.2s", marginLeft: 4 }}>●</span>
                <span style={{ display: "inline-block", animation: "pulse 1s infinite 0.4s", marginLeft: 4 }}>●</span>
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>Claude réfléchit…</div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          style={{ marginTop: 16, display: "flex", gap: 8 }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Écris ce qui change dans ta tréso…"
            disabled={loading}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              fontSize: 14,
              outline: "none",
              background: "white",
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              border: "none",
              background: GRADIENT,
              color: "white",
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? "wait" : "pointer",
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >
            Envoyer →
          </button>
        </form>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    </AppShell>
  );
}