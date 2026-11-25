import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid size-9 shrink-0 place-items-center rounded-xl bg-brand-gradient shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_6px_20px_-8px_rgb(139_92_246/0.8)]",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none">
        <path d="M7 5.5v13l6.5-6.5L7 5.5Z" fill="#F8FAFC" />
        <path d="M14 7l4 5-4 5" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 rounded-xl outline-offset-4"
      aria-label="ClipForge AI home"
    >
      <LogoMark />
      {!collapsed && (
        <span className="font-heading text-[17px] font-semibold tracking-tight">
          ClipForge <span className="text-lavender">AI</span>
        </span>
      )}
    </Link>
  );
}
