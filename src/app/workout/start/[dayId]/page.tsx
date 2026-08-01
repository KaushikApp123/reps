import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOnboarded } from "@/lib/data";

/**
 * Creates (or resumes) a workout log for a split day, then hands off to the
 * active workout screen. Kept as its own route so "Start" is a plain link.
 */
export default async function StartWorkoutPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  const { dayId } = await params;
  const { userId } = await requireOnboarded();
  const supabase = await createClient();

  // Ownership check — RLS would block a foreign day, but fail clearly here.
  const { data: day } = await supabase
    .from("split_days")
    .select("id, splits!inner(user_id)")
    .eq("id", dayId)
    .single();

  const owner = (day as { splits?: { user_id: string } } | null)?.splits?.user_id;
  if (!day || owner !== userId) redirect("/dashboard");

  const { data: existing } = await supabase
    .from("workout_logs")
    .select("id")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("performed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) redirect(`/workout/${existing.id}`);

  const { data: created, error } = await supabase
    .from("workout_logs")
    .insert({ user_id: userId, split_day_id: dayId })
    .select("id")
    .single();

  if (error || !created) redirect("/dashboard");
  redirect(`/workout/${created.id}`);
}
