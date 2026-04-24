"use client";
import { AppShell, ComingSoon } from "@/components/app-shell";
export default function Page() {
  return (
    <AppShell>
      <ComingSoon icon="🧙" title="Simulateur de scénarios" sprint="Sprint 5"
        description="Joue avec les curseurs pour simuler l'impact d'une embauche, d'un retard de paiement, ou d'un emprunt sur ta trésorerie 12 mois. Visualise instantanément le nouveau solde prévu." />
    </AppShell>
  );
}