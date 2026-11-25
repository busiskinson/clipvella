import { PageContainer } from "@/components/common/page";
import { WelcomeHero } from "@/components/dashboard/welcome-hero";
import { RecentProjects } from "@/components/dashboard/recent-projects";
import { ActivityChart, CreditsCard, UsageStats } from "@/components/dashboard/usage-stats";

export default function DashboardPage() {
  return (
    <PageContainer className="grid gap-8">
      <WelcomeHero />
      <RecentProjects />
      <UsageStats />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <ActivityChart />
        <CreditsCard />
      </div>
    </PageContainer>
  );
}
