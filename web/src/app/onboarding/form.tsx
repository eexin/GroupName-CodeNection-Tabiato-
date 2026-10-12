"use client";

import { useActionState } from "react";
import { saveProfile, type ProfileState } from "@/features/profile/actions";
import { Ato } from "@/components/ato";
import { Chips } from "@/components/chips";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/submit";
import type { TravelStyle } from "@/lib/types";

export function OnboardingForm({ name, username, style }: { name: string; username: string; style: TravelStyle }) {
  const [state, action] = useActionState<ProfileState, FormData>(saveProfile, {});
  return (
    <form action={action} className="space-y-5">
      <Field label="Display name" name="name" defaultValue={name} maxLength={40} required />
      <Field label="Username — friends find you with @username" name="username" defaultValue={username} maxLength={24} required
        pattern="[a-z0-9_]{3,24}" autoCapitalize="none" autoCorrect="off" />
      <div className="flex items-center gap-3 rounded-[16px] bg-surface p-3">
        <Ato size={60} mood="happy" />
        <p className="text-[11.5px] leading-snug text-body">
          <strong className="block text-[12.5px] text-ink">This is your Travel DNA.</strong>
          I plan around it every trip.
        </p>
      </div>
      <fieldset>
        <legend className="mb-2 text-[12.5px] font-medium text-body">Budget</legend>
        <Chips name="budget" defaultValue={style.budget ?? "mid"}
          options={[{ value: "budget", label: "Budget" }, { value: "mid", label: "Mid-range" }, { value: "luxury", label: "Luxury" }]} />
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-[12.5px] font-medium text-body">Interests</legend>
        <Chips name="interests" type="checkbox" defaultValue={style.interests ?? []}
          options={["Food", "Nature", "Culture", "Shopping", "Nightlife", "Museums"].map((x) => ({ value: x.toLowerCase(), label: x }))} />
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-[12.5px] font-medium text-body">Pace</legend>
        <Chips name="pace" defaultValue={style.pace ?? "balanced"}
          options={[{ value: "slow", label: "Slow" }, { value: "balanced", label: "Balanced" }, { value: "packed", label: "Packed" }]} />
      </fieldset>
      <FormMessage error={state.error} />
      <Submit>Continue</Submit>
    </form>
  );
}
