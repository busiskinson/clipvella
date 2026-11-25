import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorWorkspace } from "@/components/editor/editor-workspace";

export const metadata: Metadata = { title: "Video Editor" };

export default function EditorPage() {
  return (
    // useSearchParams needs a Suspense boundary under cacheComponents
    <Suspense fallback={<div className="m-3 h-[calc(100dvh-5.5rem)] animate-pulse rounded-xl bg-white/[0.03]" />}>
      <EditorWorkspace />
    </Suspense>
  );
}
