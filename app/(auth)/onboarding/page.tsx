import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/auth/current-user";
import OnboardingWizard from "../../../components/onboarding/onboarding-wizard";
import { completeOnboardingAction, skipOnboardingAction } from "../actions";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.onboardingCompletedAt) redirect("/dashboard");

  return (
    <OnboardingWizard
      completeAction={completeOnboardingAction}
      skipAction={skipOnboardingAction}
      initial={{
        university: user.university ?? "",
        major: user.major ?? "",
        cohort: user.cohort ?? "",
        focusGoal: user.focusGoal ?? "",
        focusSessionMins: user.focusSessionMins ?? 25,
        prefersBattles: user.prefersBattles,
        prefersGuild: user.prefersGuild,
      }}
    />
  );
}

