import { redirect } from "next/navigation";

export default function RssIndexPage() {
  redirect("/feeds");
}
