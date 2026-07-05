import { StrategyReviewClient } from "./strategy-review-client";

/** Public, standalone editorial-strategy review page (no app shell, no auth).
 * The client opens this link, reads the editorial line, and approves or requests
 * changes before any production starts. */
export default async function StrategyReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <StrategyReviewClient token={token} />;
}
