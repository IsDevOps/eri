import { redirect } from "next/navigation";
import { HOME, getUser } from "@/lib/auth";
import { RegisterForm } from "@/components/AuthForm";

export default async function RegisterPage() {
  const u = await getUser();
  if (u) redirect(HOME[u.role]);
  return <RegisterForm />;
}
