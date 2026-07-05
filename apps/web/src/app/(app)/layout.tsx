import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { WorkspaceProvider } from "@/lib/workspace";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
