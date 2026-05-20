import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SuspendedClient } from "./suspended-client";

export default async function SuspendedPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Kalau sudah aktif lagi, redirect ke dashboard
  if (
    session.user.subscriptionStatus !== "SUSPENDED" &&
    session.user.subscriptionStatus !== "EXPIRED"
  ) {
    redirect("/dashboard");
  }

  const isSuspended = session.user.subscriptionStatus === "SUSPENDED";

  return (
    <SuspendedClient
      isSuspended={isSuspended}
      email={session.user.email}
      name={session.user.name}
    />
  );
}
