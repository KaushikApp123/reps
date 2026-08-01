import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/data";
import OnboardingWizard from "./wizard";

export default async function OnboardingPage() {
  const { profile } = await requireProfile();
  if (profile.onboarding_complete) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <OnboardingWizard name={profile.display_name} />
    </main>
  );
}
