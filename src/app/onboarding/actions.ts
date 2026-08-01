"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/data";
import { getSplitTemplate, groupsForDay } from "@/lib/splits";
import type { EquipmentTier, Goal } from "@/lib/types";

const GOALS: Goal[] = ["strength", "hypertrophy", "general"];
const TIERS: EquipmentTier[] = ["bodyweight", "home", "full_gym"];

export async function completeOnboarding(formData: FormData) {
  const { userId } = await requireProfile();

  const goal = String(formData.get("goal") ?? "") as Goal;
  const equipment = String(formData.get("equipment") ?? "") as EquipmentTier;
  const days = Number(formData.get("days_per_week") ?? 0);
  const splitKey = String(formData.get("split_key") ?? "");

  if (!GOALS.includes(goal)) throw new Error("Invalid goal");
  if (!TIERS.includes(equipment)) throw new Error("Invalid equipment profile");
  if (!Number.isInteger(days) || days < 2 || days > 6) {
    throw new Error("Days per week must be between 2 and 6");
  }

  const template = getSplitTemplate(splitKey);
  if (!template) throw new Error("Invalid split");

  const supabase = await createClient();

  // Retire any previous program so only one split is active.
  await supabase
    .from("splits")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);

  const { data: split, error: splitError } = await supabase
    .from("splits")
    .insert({ user_id: userId, name: template.name, is_active: true })
    .select("id")
    .single();

  if (splitError || !split) {
    throw new Error(splitError?.message ?? "Could not create split");
  }

  const { error: daysError } = await supabase.from("split_days").insert(
    template.days.map((d, i) => ({
      split_id: split.id,
      name: d.name,
      order_index: i,
      required_muscles: d.required,
      optional_muscles: d.optional ?? [],
      // Kept in sync for the coarse filtering the swipe deck uses.
      muscle_groups: groupsForDay(d),
    })),
  );

  if (daysError) throw new Error(daysError.message);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      goal,
      equipment_profile: equipment,
      days_per_week: days,
      onboarding_complete: true,
    })
    .eq("id", userId);

  if (profileError) throw new Error(profileError.message);

  revalidatePath("/", "layout");
  redirect("/build");
}
