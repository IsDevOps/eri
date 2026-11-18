import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HOME, getUser } from "@/lib/auth";
import { LoginForm } from "@/components/AuthForm";

export default async function LoginPage() {
  const u = await getUser();
  if (u) redirect(HOME[u.role]);
  const demo = process.env.DEMO_LOGINS === "1";
  return (
    <Suspense>
      <LoginForm demo={demo} demoPassword={demo ? (process.env.SEED_PASSWORD ?? "eri-demo-2026") : ""} />
    </Suspense>
  );
}
