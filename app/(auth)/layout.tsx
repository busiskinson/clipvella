import { Suspense } from "react";
import { LogoMark } from "@/components/shell/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="glass relative w-full max-w-sm overflow-hidden rounded-3xl p-6 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-violet/20 blur-3xl" />
        <div className="relative">
          <div className="mb-6 flex items-center gap-3">
            <LogoMark />
            <span className="font-heading text-[17px] font-semibold tracking-tight">
              ClipForge <span className="text-lavender">AI</span>
            </span>
          </div>
          {/* useSearchParams in the form needs a Suspense boundary under cacheComponents */}
          <Suspense>{children}</Suspense>
        </div>
      </div>
    </main>
  );
}
