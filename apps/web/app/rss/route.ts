import { redirect } from "next/navigation";

/**
 * /rss — redirect to /rss.xml
 *
 * Medium and other platforms often link to /rss instead of /rss.xml.
 * This route handler catches those requests and issues a permanent
 * redirect so visitors (human and agent) land on the actual feed.
 */
export function GET() {
  redirect("/rss.xml");
}