import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { getCurrentUser } from "@/lib/session";
import { coinpayEnabled, coinpayOAuthConfig } from "@/lib/coinpay-signin";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ coinpay_choose?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect("/account");
  return <LoginForm coinpay={coinpayEnabled(coinpayOAuthConfig())} coinpayChoose={params.coinpay_choose === "1"} />;
}
