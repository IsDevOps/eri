import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HOME, getUser } from "@/lib/auth";
import { LoginForm } from "@/components/AuthForm";

export default async function LoginPage() {
  const u = await getUser();
  if (u) redirect(HOME[u.role]);
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
