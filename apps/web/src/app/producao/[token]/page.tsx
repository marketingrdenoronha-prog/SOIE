import { ProductionPortalClient } from "./portal-client";
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ProductionPortalClient token={token} />;
}
