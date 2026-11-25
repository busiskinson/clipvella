import type { Metadata } from "next";
import { EditorWorkspace } from "@/components/editor/editor-workspace";

export const metadata: Metadata = { title: "Video Editor" };

export default function EditorPage() {
  return <EditorWorkspace />;
}
