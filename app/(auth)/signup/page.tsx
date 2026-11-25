import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Create the owner account</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        This workspace has a single owner. Sign-ups are closed once your account exists.
      </p>
      <AuthForm mode="signup" />
    </>
  );
}
