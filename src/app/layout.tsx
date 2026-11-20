
import type { Metadata } from "next";
import { Suspense } from "react";
import { DeniedNotice } from "@/components/Nav";
import PartyBoot from "@/components/PartyBoot";
import { getUser } from "@/lib/auth";
import { getPartyDefs } from "@/lib/db";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Ẹ̀rí — Trace every vote from the polling unit to the declaration",
  description:
    "Trace polling-unit evidence, check forwarded result sheets, and report election-day concerns safely.",
};

export default async function RootLayout({
  children,
}: LayoutProps<"/">) {
  const user = await getUser();
  const parties = await getPartyDefs();

  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("eri-theme");var d=t||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch(e){}})();`,
          }}
        />
      </head>

      <body className="min-h-full bg-[#0b0f14] text-slate-200">
        <PartyBoot parties={parties} />
        <Suspense>
          <DeniedNotice />
        </Suspense>

        <AppShell
          user={user ? { name: user.name, role: user.role } : null}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
