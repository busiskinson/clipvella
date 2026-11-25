import { SidebarNav } from "@/components/shell/sidebar-nav";
import { Topbar } from "@/components/shell/topbar";
import { QuickSearch } from "@/components/shell/quick-search";
import { NewProjectDialog } from "@/components/common/new-project-dialog";
import { ProfileSync } from "@/components/auth/profile-sync";

/** Signed-in app shell. proxy.ts guarantees a session before these routes render. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <ProfileSync />
      <div className="flex min-h-dvh">
        <SidebarNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="main" className="flex min-w-0 flex-1 flex-col">
            {children}
          </main>
        </div>
      </div>
      <QuickSearch />
      <NewProjectDialog />
    </>
  );
}
