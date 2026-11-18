import { requirePage } from "@/lib/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePage(["admin"]);
  return children;
}
