import type { HeatmapCell } from "@/lib/stats";

/**
 * Single-hue sequential ramp defined in globals.css and validated against the
 * dark chart surface (#141416) — the light end clears the 2:1 contrast floor.
 * Level 0 is the recessive empty-cell surface, not part of the ramp.
 */
const LEVEL_COLOR: Record<number, string> = {
  0: "var(--surface-2)",
  1: "var(--ramp-1)",
  2: "var(--ramp-2)",
  3: "var(--ramp-3)",
  4: "var(--ramp-4)",
};

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

export default function Heatmap({
  weeks,
  unit,
}: {
  weeks: HeatmapCell[][];
  unit: string;
}) {
  return (
    <figure className="m-0">
      <div className="overflow-x-auto pb-1">
        <div className="flex items-start gap-[3px]">
          {/* Day-of-week gutter */}
          <div className="mr-1 flex shrink-0 flex-col gap-[3px]">
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="flex h-[11px] items-center text-[9px] leading-none text-muted"
              >
                {label}
              </div>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} className="flex shrink-0 flex-col gap-[3px]">
              {week.map((cell) => (
                <div
                  key={cell.key}
                  title={
                    cell.future
                      ? ""
                      : `${cell.date.toLocaleDateString()} — ${
                          cell.volume > 0
                            ? `${Math.round(cell.volume).toLocaleString()} ${unit}`
                            : "rest day"
                        }`
                  }
                  className="h-[11px] w-[11px] rounded-[3px]"
                  style={{
                    backgroundColor: cell.future
                      ? "transparent"
                      : LEVEL_COLOR[cell.level],
                    opacity: cell.future ? 0 : 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <figcaption className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span
            key={l}
            className="h-[11px] w-[11px] rounded-[3px]"
            style={{ backgroundColor: LEVEL_COLOR[l] }}
          />
        ))}
        <span>More</span>
      </figcaption>
    </figure>
  );
}
