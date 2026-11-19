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
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("eri-theme");var d=t||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full bg-[#0b0f14] text-slate-200">
        <div className="min-h-screen lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
          <Nav user={user ? { name: user.name, role: user.role } : null} />
          <div className="min-w-0">
            <Suspense>
              <DeniedNotice />
            </Suspense>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
