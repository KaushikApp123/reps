import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "./types";

/**
 * Returns the signed-in user and their profile, redirecting to /login if
 * there is no session. Every Server Action and protected page should call
 * this rather than trusting the proxy redirect alone.
 */
export async function requireProfile(): Promise<{
  userId: string;
  profile: Profile;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, display_name, goal, equipment_profile, days_per_week, weight_unit, onboarding_complete",
    )
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Profile row missing (e.g. user predates the signup trigger) — create it.
    const { data: created } = await supabase
      .from("profiles")
      .insert({ id: user.id, display_name: user.email?.split("@")[0] ?? null })
      .select(
        "id, display_name, goal, equipment_profile, days_per_week, weight_unit, onboarding_complete",
      )
      .single();

    if (!created) redirect("/login");
    return { userId: user.id, profile: created as Profile };
  }

  return { userId: user.id, profile: profile as Profile };
}

/** Requires a completed onboarding; sends the user there if not done. */
export async function requireOnboarded() {
  const { userId, profile } = await requireProfile();
  if (!profile.onboarding_complete) redirect("/onboarding");
  return { userId, profile };
}

/** The user's active split with its days, ordered. */
export async function getActiveSplit(userId: string) {
  const supabase = await createClient();
  const { data: split } = await supabase
    .from("splits")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!split) return null;

  const { data: days } = await supabase
    .from("split_days")
    .select(
      "id, split_id, name, order_index, muscle_groups, required_muscles, optional_muscles",
    )
    .eq("split_id", split.id)
    .order("order_index");

  return { split, days: days ?? [] };
}
