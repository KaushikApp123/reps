"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Train", icon: DumbbellIcon },
  { href: "/build", label: "Routine", icon: CardsIcon },
  { href: "/progress", label: "Progress", icon: ChartIcon },
];

/**
 * Routes that own the whole screen. The nav is hidden during a workout so
 * nothing competes with logging the next set, and hidden pre-onboarding
 * because those destinations don't exist yet.
 */
const HIDDEN_PREFIXES = ["/login", "/onboarding", "/workout"];

export default function BottomNav() {
  const pathname = usePathname();
  if (!pathname || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-40 mt-auto border-t border-border bg-background/85 backdrop-blur-xl"
    >
      <ul
        className="mx-auto flex w-full max-w-md items-stretch px-2 pt-1.5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 6px)" }}
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`tap flex flex-col items-center gap-1 rounded-[var(--radius-md)] py-2 ${
                  active ? "text-accent" : "text-subtle hover:text-muted"
                }`}
              >
                <Icon active={active} />
                <span className="text-[10px] font-semibold tracking-wide">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DumbbellIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.9}
        strokeLinecap="round"
      />
    </svg>
  );
}

function CardsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="7" y="4" width="12" height="15" rx="3"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.9}
      />
      <path
        d="M4 7.5v9a3 3 0 0 0 2 2.83"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.9}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 19h16"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.9}
        strokeLinecap="round"
      />
      <path
        d="M7 16v-4M12 16V6M17 16v-7"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.9}
        strokeLinecap="round"
      />
    </svg>
  );
}
