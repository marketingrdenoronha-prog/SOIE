import { EditorialReviewClient } from "./editorial-review-client";

/** Public, standalone editorial strategy review page (no app shell, no auth). */
export default async function EditorialReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <EditorialReviewClient token={token} />;
}
