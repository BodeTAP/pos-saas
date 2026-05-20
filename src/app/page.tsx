import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  if (!session) redirect("/login");

  if (session.user.role === "SUPER_ADMIN") redirect("/super-admin");
  if (session.user.role === "KASIR") redirect("/dashboard/pos");

  redirect("/dashboard");
}
