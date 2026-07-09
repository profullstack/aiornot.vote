import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getSponsorship } from "@/lib/sponsorships";
import { SponsorCheckoutPoller } from "@/components/SponsorUI";

export const metadata = { title: "Sponsor checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SponsorCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const s = await getSponsorship(id, user.id);
  if (!s) notFound();

  return (
    <div className="container">
      <SponsorCheckoutPoller
        id={s.id}
        amountUsd={s.amountUsd}
        blockchain={s.blockchain || "SOL"}
        address={s.paymentAddress || ""}
        cryptoAmount={s.cryptoAmount || ""}
        prizeLabel={s.prizeLabel}
      />
    </div>
  );
}
