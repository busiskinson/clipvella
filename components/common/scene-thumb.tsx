import { sceneFor } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

/**
 * Stylised stand-in for a video frame. Used wherever sample media has no real file.
 * Purely decorative: callers provide accessible text.
 */
export function SceneThumb({
  hue,
  className,
  children,
  subject = true,
}: {
  hue: number;
  className?: string;
  children?: React.ReactNode;
  subject?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: sceneFor(hue) }}>
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.18),transparent_45%)]" />
      {subject && (
        <div aria-hidden className="absolute inset-x-0 bottom-0 flex justify-center">
          {/* abstract "speaker" silhouette */}
          <div className="relative h-[58%] w-[46%] min-w-10">
            <div className="absolute left-1/2 top-0 aspect-square w-[34%] -translate-x-1/2 rounded-full bg-black/35" />
            <div className="absolute inset-x-0 bottom-0 h-[62%] rounded-t-[999px] bg-black/35" />
          </div>
        </div>
      )}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      {children}
    </div>
  );
}
