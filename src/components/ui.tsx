import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

function buttonClasses(variant: Variant, size: Size, full?: boolean) {
  const base =
    "tap inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold " +
    "disabled:opacity-40 disabled:pointer-events-none select-none";

  const sizes: Record<Size, string> = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-[15px]",
    lg: "px-5 py-4 text-base",
  };

  const variants: Record<Variant, string> = {
    primary:
      "bg-accent text-white shadow-[0_6px_20px_-8px_var(--accent-ring)] hover:bg-accent-hover",
    secondary:
      "bg-surface-3 text-foreground border border-border hover:border-border-strong",
    ghost:
      "bg-transparent text-muted border border-border hover:text-foreground hover:border-border-strong",
    danger: "bg-danger text-white hover:opacity-90",
  };

  return `${base} ${sizes[size]} ${variants[variant]} ${full ? "w-full" : ""}`;
}

export function Button({
  variant = "primary",
  size = "md",
  full,
  className = "",
  ...props
}: ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  full?: boolean;
}) {
  return <button {...props} className={`${buttonClasses(variant, size, full)} ${className}`} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  full,
  className = "",
  ...props
}: ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  full?: boolean;
}) {
  return <Link {...props} className={`${buttonClasses(variant, size, full)} ${className}`} />;
}

export function Card({
  children,
  className = "",
  interactive,
  accent,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`card-glow rounded-[var(--radius-lg)] border p-4 ${
        accent ? "border-accent/50 bg-accent-soft" : "border-border bg-surface"
      } ${interactive ? "tap hover:border-border-strong" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/** Big single number — the thing a screen leads with. */
export function Hero({
  value,
  label,
  sub,
}: {
  value: string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">
        {label}
      </p>
      <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "accent" | "success" | "gold";
}) {
  const valueTone =
    tone === "accent"
      ? "text-accent"
      : tone === "success"
        ? "text-success"
        : tone === "gold"
          ? "text-gold"
          : "text-foreground";

  return (
    <div className="card-glow rounded-[var(--radius-lg)] border border-border bg-surface px-3 py-3.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-subtle">
        {label}
      </div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums tracking-tight ${valueTone}`}>
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-[11px] text-subtle">{sub}</div> : null}
    </div>
  );
}

export function Chip({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "success" | "gold" | "muted";
  className?: string;
}) {
  const tones = {
    default: "bg-surface-3 text-muted border-border",
    accent: "bg-accent-soft text-accent border-accent/40",
    success: "bg-success/12 text-success border-success/30",
    gold: "bg-gold/12 text-gold border-gold/30",
    muted: "bg-surface-2 text-subtle border-border",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function EquipmentBadge({ tier }: { tier: string }) {
  const label =
    tier === "bodyweight" ? "Bodyweight" : tier === "home" ? "Home" : "Gym";
  return <Chip tone="muted">{label}</Chip>;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-subtle">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[26px] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-subtle">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "accent",
}: {
  value: number;
  tone?: "accent" | "success";
}) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-3">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${
          tone === "success" ? "bg-success" : "bg-accent"
        }`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-border px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-surface-2 text-2xl">
        {icon}
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-[34ch] text-sm text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
