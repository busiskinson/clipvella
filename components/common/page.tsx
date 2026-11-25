import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageContainer({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)} {...props} />;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold text-balance sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function GlassCard({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("glass min-w-0 rounded-2xl", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
            <Icon aria-hidden className="size-4 text-lavender" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

/** Marks functionality that is simulated in the browser until a backend exists. */
export function DemoBadge({ label = "Demo", className, title }: { label?: string; className?: string; title?: string }) {
  return (
    <span
      title={title ?? "Frontend demonstration — no real AI processing is connected yet"}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 text-xs font-medium text-warning",
        className,
      )}
    >
      <FlaskConical aria-hidden className="size-3" />
      {label}
    </span>
  );
}

export function SampleDataNote({ className, children = "Sample data" }: { className?: string; children?: React.ReactNode }) {
  return (
    <span className={cn("rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-muted-foreground", className)}>
      {children}
    </span>
  );
}
