import { getAllPlans } from "@/lib/plans";
import { PlansClient } from "./plans-client";

export default async function PlansAdminPage() {
  const plans = await getAllPlans();
  return <PlansClient initialPlans={plans} />;
}
