import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/common/page";
import { ProjectsView } from "@/components/projects/projects-view";
import { NewProjectButton } from "@/components/common/new-project-button";

export const metadata: Metadata = { title: "My Projects" };

export default function ProjectsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="My Projects"
        description="Every clip, edit, caption set and imported video you have made."
        actions={<NewProjectButton />}
      />
      <ProjectsView />
    </PageContainer>
  );
}
