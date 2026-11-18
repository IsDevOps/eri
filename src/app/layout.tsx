import type { Metadata } from "next";
import { Suspense } from "react";
import { DeniedNotice, Nav } from "@/components/Nav";
import { getUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ẹ̀rí — Evidence from the wall to the final result",
  description: "Trace polling-unit evidence, check forwarded result sheets, and report election-day concerns safely.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#0b0f14] text-slate-200">
        <Nav user={user ? { name: user.name, role: user.role } : null} />
        <Suspense>
          <DeniedNotice />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
