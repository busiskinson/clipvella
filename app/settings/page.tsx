import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/common/page";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageContainer className="max-w-[1200px]">
      <PageHeader title="Settings" description="Changes save automatically to this browser." />
      <SettingsView />
    </PageContainer>
  );
}
