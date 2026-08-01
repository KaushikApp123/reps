"use client";

import { useMemo, useState } from "react";

export type ExerciseSeries = {
  exerciseId: string;
  name: string;
  points: { date: string; topWeight: number; volume: number }[];
};

const W = 320;
const H = 160;
const PAD = { top: 14, right: 14, bottom: 24, left: 36 };

export default function ExerciseChart({
  series,
  unit,
}: {
  series: ExerciseSeries[];
  unit: string;
}) {
  const [selectedId, setSelectedId] = useState(series[0]?.exerciseId ?? "");
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const active = series.find((s) => s.exerciseId === selectedId) ?? series[0];

  const geom = useMemo(() => {
    if (!active || active.points.length === 0) return null;
    const pts = active.points;
    const ys = pts.map((p) => p.topWeight);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    // Pad the domain so a flat line doesn't sit on the axis.
    const lo = min === max ? Math.max(0, min - 5) : min - (max - min) * 0.15;
    const hi = min === max ? max + 5 : max + (max - min) * 0.15;

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const x = (i: number) =>
      pts.length === 1
        ? PAD.left + innerW / 2
        : PAD.left + (i / (pts.length - 1)) * innerW;
    const y = (v: number) =>
      PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;

    return { pts, x, y, lo, hi, min, max };
  }, [active]);

  if (!active || !geom) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
        Log a few workouts and your progress will show up here.
      </p>
    );
  }

  const { pts, x, y, lo, hi, max } = geom;
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.topWeight)}`).join(" ");
  const hovered = hover !== null ? pts[hover] : null;
  const latest = pts[pts.length - 1];

  return (
    <div>
      {/* Exercise selector */}
      <div className="mb-3">
        <label className="sr-only" htmlFor="exercise-select">
          Exercise
        </label>
        <select
          id="exercise-select"
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setHover(null);
          }}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 outline-none focus:border-accent"
        >
          {series.map((s) => (
            <option key={s.exerciseId} value={s.exerciseId}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <figure className="m-0 rounded-2xl border border-border bg-surface p-3">
        {/* A single series needs no legend — the title names it. */}
        <figcaption className="mb-1 px-1">
          <span className="text-sm font-semibold">{active.name}</span>
          <span className="ml-2 text-xs text-muted">
            top set ({unit}) · {pts.length} session{pts.length === 1 ? "" : "s"}
          </span>
        </figcaption>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${active.name} top set weight over ${pts.length} sessions, from ${pts[0].topWeight} to ${latest.topWeight} ${unit}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const innerW = W - PAD.left - PAD.right;
            const ratio = (px - PAD.left) / innerW;
            const i = Math.round(ratio * (pts.length - 1));
            setHover(Math.max(0, Math.min(pts.length - 1, i)));
          }}
        >
          {/* Recessive gridlines + y labels */}
          {[lo, (lo + hi) / 2, hi].map((v, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y(v) + 3}
                textAnchor="end"
                fontSize={8}
                fill="var(--muted)"
              >
                {Math.round(v)}
              </text>
            </g>
          ))}

          {/* Crosshair */}
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--muted)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {/* Series line — 2px, single sequential hue */}
          <path
            d={path}
            fill="none"
            stroke="#8878ff"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Markers, with a surface ring so overlaps stay readable */}
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.topWeight)}
              r={hover === i ? 5 : 4}
              fill="#8878ff"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}

          {/* Selective direct labels: the peak and the latest, never every point */}
          {pts.length > 1 && (
            <text
              x={x(pts.length - 1)}
              y={y(latest.topWeight) - 9}
              textAnchor="end"
              fontSize={9}
              fontWeight={700}
              fill="var(--foreground)"
            >
              {latest.topWeight}
            </text>
          )}
          {max !== latest.topWeight && (
            <text
              x={x(pts.findIndex((p) => p.topWeight === max))}
              y={y(max) - 9}
              textAnchor="middle"
              fontSize={9}
              fill="var(--muted)"
            >
              {max}
            </text>
          )}

          {/* x-axis end labels only — dates on every point would collide */}
          <text x={PAD.left} y={H - 8} fontSize={8} fill="var(--muted)">
            {shortDate(pts[0].date)}
          </text>
          <text
            x={W - PAD.right}
            y={H - 8}
            textAnchor="end"
            fontSize={8}
            fill="var(--muted)"
          >
            {shortDate(latest.date)}
          </text>
        </svg>

        {/* Tooltip */}
        <div className="mt-2 min-h-[38px] px-1">
          {hovered ? (
            <div className="rounded-lg bg-surface-2 px-3 py-2 text-xs">
              <div className="font-semibold tabular-nums">
                {hovered.topWeight} {unit} top set
              </div>
              <div className="text-muted">
                {new Date(hovered.date).toLocaleDateString()} ·{" "}
                {Math.round(hovered.volume).toLocaleString()} {unit} volume
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted">
              Hover or tap the chart for a session&apos;s numbers.
            </p>
          )}
        </div>
      </figure>

      {/* Table view — identity and values never depend on color alone */}
      <button
        onClick={() => setShowTable((v) => !v)}
        className="mt-2 text-xs text-muted underline hover:text-foreground"
      >
        {showTable ? "Hide" : "Show"} data table
      </button>

      {showTable && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Date</th>
                <th className="py-1.5 pr-3 font-medium">Top set ({unit})</th>
                <th className="py-1.5 font-medium">Volume ({unit})</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {pts.map((p, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1.5 pr-3">
                    {new Date(p.date).toLocaleDateString()}
                  </td>
                  <td className="py-1.5 pr-3">{p.topWeight}</td>
                  <td className="py-1.5">
                    {Math.round(p.volume).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
