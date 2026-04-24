"use client";
import { AppShell, ComingSoon } from "@/components/app-shell";
export default function Page() {
  return (
    <AppShell>
      <ComingSoon icon="📄" title="Rapports & exports" sprint="Sprint 6"
        description="Génère en 1 clic : plan de trésorerie 12 mois (PDF pour banquier), export P&L Excel (pour expert-comptable), dossier de financement (pour demande de prêt pro)." />
    </AppShell>
  );
}