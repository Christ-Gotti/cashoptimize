"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { AppShell } from "@/components/app-shell";

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

type Profile = {
  email: string;
  fullName: string;
  createdAt: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const [notice, setNotice] = useState<{ tone: "info" | "success" | "warning"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowser();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const fn = (data.user.user_metadata?.full_name as string | undefined) ?? "";
      setProfile({
        email: data.user.email ?? "",
        fullName: fn,
        createdAt: data.user.created_at ?? "",
      });
      setFullName(fn);
    }
    load();
  }, []);

  function showNotice(tone: "info" | "success" | "warning", text: string) {
    setNotice({ tone, text });
    setTimeout(() => setNotice(null), 5000);
  }

  async function saveProfile() {
    setSavingProfile(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    setSavingProfile(false);
    if (error) showNotice("warning", "Impossible de mettre à jour ton profil.");
    else {
      showNotice("success", "Profil mis à jour.");
      setProfile((p) => (p ? { ...p, fullName } : p));
    }
  }

  async function changePassword() {
    if (newPwd.length < 8) {
      showNotice("warning", "Mot de passe : 8 caractères minimum.");
      return;
    }
    if (newPwd !== confirmPwd) {
      showNotice("warning", "Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSavingPwd(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSavingPwd(false);
    if (error) {
      showNotice("warning", "Impossible de changer ton mot de passe. Réessaie.");
      return;
    }
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    showNotice("success", "Mot de passe mis à jour.");
  }

  async function deleteAccount() {
    if (deleteConfirm !== "SUPPRIMER") {
      showNotice("warning", "Tape SUPPRIMER en majuscules pour confirmer.");
      return;
    }
    setDeleting(true);
    try {
      const supabase = createSupabaseBrowser();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error();
      await supabase.auth.signOut();
      router.push("/?deleted=1");
    } catch {
      showNotice("warning", "Impossible de supprimer le compte. Contacte le support.");
      setDeleting(false);
    }
  }

  return (
    <AppShell>
      <div style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "white" }}>⚙</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0 }}>Paramètres</h1>
        </div>
        <p style={{ color: "#64748b", marginTop: 8, marginBottom: 32, fontSize: 15 }}>Gère ton profil, ta sécurité et tes données.</p>

        {notice && (
          <div style={{ marginBottom: 24, padding: "12px 14px", borderRadius: 12, border: `1px solid ${noticeColors[notice.tone].border}`, background: noticeColors[notice.tone].bg, color: noticeColors[notice.tone].text, fontSize: 13.5, lineHeight: 1.5 }}>
            {notice.text}
          </div>
        )}

        <Section title="Profil" description="Tes informations personnelles">
          <Field label="Adresse email">
            <div style={{ ...inputStyle, color: "#94a3b8", background: "#f8fafc", cursor: "not-allowed" }}>{profile?.email ?? "…"}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>L'adresse email ne peut pas être modifiée. Contacte le support si besoin.</div>
          </Field>
          <Field label="Prénom Nom">
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ton nom" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          </Field>
          {profile?.createdAt && (
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>Compte créé le {new Date(profile.createdAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}</div>
          )}
          <div style={{ marginTop: 16 }}>
            <button onClick={saveProfile} disabled={savingProfile || fullName === profile?.fullName} style={primaryBtn(savingProfile || fullName === profile?.fullName)}>
              {savingProfile ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </Section>

        <Section title="Sécurité" description="Modifie ton mot de passe">
          <Field label="Nouveau mot de passe">
            <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="8 caractères minimum" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          </Field>
          <Field label="Confirme le nouveau mot de passe">
            <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Retape-le" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          </Field>
          <div style={{ marginTop: 16 }}>
            <button onClick={changePassword} disabled={savingPwd || !newPwd || !confirmPwd} style={primaryBtn(savingPwd || !newPwd || !confirmPwd)}>
              {savingPwd ? "Enregistrement…" : "Changer le mot de passe"}
            </button>
          </div>
        </Section>

        <Section title="Données" description="Export et suppression de ton compte">
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 16 }}>
            Conformément au RGPD, tu peux supprimer définitivement ton compte et toutes tes données. Cette action est <strong style={{ color: "#dc2626" }}>irréversible</strong>.
          </p>
          <Field label="Tape SUPPRIMER pour confirmer">
            <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="SUPPRIMER" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          </Field>
          <div style={{ marginTop: 16 }}>
            <button onClick={deleteAccount} disabled={deleting || deleteConfirm !== "SUPPRIMER"} style={dangerBtn(deleting || deleteConfirm !== "SUPPRIMER")}>
              {deleting ? "Suppression…" : "🗑 Supprimer définitivement mon compte"}
            </button>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: 24, marginBottom: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>{title}</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 20 }}>{description}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, color: "#0f172a", background: "white", outline: "none", transition: "border-color 150ms, box-shadow 150ms", boxSizing: "border-box" };

const onFocus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "#a5b4fc"; e.currentTarget.style.boxShadow = "0 0 0 4px rgba(99, 102, 241, 0.1)"; };
const onBlur = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; };

const primaryBtn = (disabled: boolean): React.CSSProperties => ({ padding: "10px 18px", borderRadius: 10, border: "none", background: GRADIENT, color: "white", fontSize: 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 });

const dangerBtn = (disabled: boolean): React.CSSProperties => ({ padding: "10px 18px", borderRadius: 10, border: "1px solid #fecaca", background: disabled ? "#f8fafc" : "white", color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 });

const noticeColors = {
  info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e3a8a" },
  success: { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" },
  warning: { bg: "#fffbeb", border: "#fde68a", text: "#78350f" },
};