"use client";

import { useActionState } from "react";
import { updatePlan, type PlanState } from "@/features/planner/actions";
import { Chips } from "@/components/chips";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/submit";

export function SetupForm({ tripId, start, end, budget, pace, interests }: { tripId: string; start: string; end: string; budget: number | null; pace: string; interests: string[] }) {
  const [state, action] = useActionState<PlanState, FormData>(updatePlan.bind(null, tripId), {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" name="start_date" type="date" defaultValue={start} required />
        <Field label="End" name="end_date" type="date" defaultValue={end} required />
      </div>
      <Field label="Budget (RM)" name="budget" inputMode="decimal" defaultValue={budget ?? ""} />
      <fieldset>
        <legend className="mb-1 text-[11px] font-bold text-ink">Preferences</legend>
        <p className="mb-2 text-[11px] text-muted">Pulled from your profile — tweak for this trip.</p>
        <Chips name="interests" type="checkbox" defaultValue={interests}
          options={["Food", "Nature", "Culture", "Shopping"].map((x) => ({ value: x.toLowerCase(), label: x }))} />
        <div className="mt-2">
          <Chips name="pace" defaultValue={pace}
            options={[{ value: "slow", label: "Slow pace" }, { value: "balanced", label: "Balanced" }, { value: "packed", label: "Packed" }]} />
        </div>
      </fieldset>
      <FormMessage error={state.error} />
      <Submit pending="Saving…">Save and generate itinerary</Submit>
    </form>
  );
}
