import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Log in to your ClipForge workspace.</p>
      <AuthForm mode="login" />
    </>
  );
}
