import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import SaasClient from "./saas-client";

export const dynamic = "force-dynamic";

export default async function SaasPage() {
  if (process.env.APP_ROLE !== "control") redirect("/");
  const user = await getSessionUser();
  if (!user || user.role !== "admin") redirect("/login");
  return <SaasClient />;
}
