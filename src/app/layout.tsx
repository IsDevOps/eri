import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { DeniedNotice, Nav } from "@/components/Nav";
import { getUser } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ẹ̀rí — Trace every vote from the polling unit to the declaration",
  description: "Watch the collation hops between the polling-unit result (EC8A) and the final declaration (EC8E), and alert citizens when their numbers change.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
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
