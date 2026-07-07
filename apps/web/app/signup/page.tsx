import { redirect } from "next/navigation";
import { SignupForm } from "@/components/AuthForms";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Sign up" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/account");
  return <SignupForm />;
}
