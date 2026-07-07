import { notFound } from "next/navigation";
import { FeedSection } from "@/components/FeedSection";

export const dynamic = "force-dynamic";

export default async function PagedFeed({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: raw } = await params;
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 1) notFound();
  return (
    <div className="container">
      <FeedSection page={page} />
    </div>
  );
}
