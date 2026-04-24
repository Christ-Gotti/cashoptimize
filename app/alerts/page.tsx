"use client";
import { AppShell, ComingSoon } from "@/components/app-shell";
export default function Page() {
  return (
    <AppShell>
      <ComingSoon icon="🔔" title="Centre d'alertes intelligentes" sprint="Sprint 5"
        description="L'IA scanne ta tréso sur 90 jours et t'alerte avant chaque dérapage : découvert probable, client en retard, opportunité de placement. Avec des actions concrètes en 1 clic." />
    </AppShell>
  );
}