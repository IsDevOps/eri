"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { setParties, type PartyDef } from "@/lib/config";

/**
 * Hands the admin-managed party list from the server layout to this browser's copy of lib/config. It must render before
 * the pages do (it sits first in <body>), and it checks every 30 s so a party added by an admin appears without a reload.
 */
export default function PartyBoot({ parties }: { parties: PartyDef[] }) {
  setParties(parties); // idempotent; runs during SSR and hydration so everything below sees the same list
  const router = useRouter();
  const sig = JSON.stringify(parties);
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/parties", { cache: "no-store" });
        if (r.ok && JSON.stringify(await r.json()) !== sig) router.refresh();
      } catch {
        /* offline: keep what we have */
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [sig, router]);
  return null;
}
