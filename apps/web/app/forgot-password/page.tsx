import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/AuthForms";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Forgot password" };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/account");
  return <ForgotPasswordForm />;
}
