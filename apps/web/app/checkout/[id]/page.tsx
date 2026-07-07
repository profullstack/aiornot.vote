import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { sqlClient } from "@/lib/db";
import { CheckoutPoller } from "@/components/PaymentUI";

export const metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const res = await sqlClient.execute({
    sql: `SELECT id, user_id, purpose, amount_usd, blockchain, payment_address, crypto_amount
          FROM payments WHERE id = ? LIMIT 1`,
    args: [id],
  });
  const p = res.rows[0];
  if (!p || p.user_id !== user.id) notFound();

  return (
    <div className="container">
      <CheckoutPoller
        paymentId={p.id as string}
        purpose={p.purpose as string}
        amountUsd={Number(p.amount_usd)}
        blockchain={p.blockchain as string}
        address={(p.payment_address as string) || ""}
        cryptoAmount={(p.crypto_amount as string) || ""}
      />
    </div>
  );
}
