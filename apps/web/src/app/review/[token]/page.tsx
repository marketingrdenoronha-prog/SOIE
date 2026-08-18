import { ReviewClient } from "./review-client";

/** Public, standalone review page (no app shell, no auth). The client opens
 * this link, sees the deliverable, and approves or requests changes. */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ReviewClient token={token} />;
}
