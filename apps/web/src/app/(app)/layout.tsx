import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { AuthGate } from "@/components/auth-gate";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto px-6 py-8 md:px-8">
            <div className="mx-auto max-w-[1280px]">{children}</div>
          </main>
        </div>
      </div>
    </AuthGate>
  );
}
