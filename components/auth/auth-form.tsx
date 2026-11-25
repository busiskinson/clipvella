"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

/** Maps Supabase auth errors to plain-language messages. */
export function authMessage(mode: Mode, raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Sign-ups are closed for this workspace.";
  if (m.includes("invalid login credentials")) return "That email and password don't match an account.";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Log in instead.";
  if (m.includes("email not confirmed")) return "Confirm your email first, or turn off email confirmation in Supabase.";
  if (m.includes("rate limit")) return "Too many attempts. Wait a minute and try again.";
  return mode === "login" ? `Couldn't log in: ${raw}` : `Couldn't create the account: ${raw}`;
}

/** Only allow same-site relative redirects after login. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use at least 8 characters for the password.");
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) return setError(authMessage(mode, err.message));
    if (!data.session) return setError("Check your inbox to confirm your email, then log in.");
    router.replace(safeNext(params.get("next")));
    router.refresh();
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11"
          aria-describedby="password-help"
          required
        />
        {mode === "signup" && (
          <p id="password-help" className="text-xs text-muted-foreground">
            At least 8 characters.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={busy}>
        {busy && <Loader2 aria-hidden className="animate-spin" />}
        {mode === "login" ? "Log in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            First time here?{" "}
            <Link href="/signup" className="text-lavender underline-offset-4 hover:underline">
              Create the owner account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-lavender underline-offset-4 hover:underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
