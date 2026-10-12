"use client";

import { useActionState } from "react";
import { createPlan, type PlanState } from "@/features/planner/actions";
import { Chips } from "@/components/chips";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/submit";
import type { TravelStyle } from "@/lib/types";

export function PlanForm({ style }: { style: TravelStyle }) {
  const [state, action] = useActionState<PlanState, FormData>(createPlan, {});
  return (
    <form action={action} className="space-y-4">
      <Field label="Destination" name="destination" placeholder="Tokyo, Japan" required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" name="start_date" type="date" required />
        <Field label="End" name="end_date" type="date" required />
      </div>
      <Field label="Budget (RM, optional)" name="budget" inputMode="decimal" placeholder="3000" />
      <fieldset>
        <legend className="mb-1 text-[11px] font-bold text-ink">Preferences</legend>
        <p className="mb-2 text-[11px] text-muted">Pulled from your profile — tweak for this trip.</p>
        <Chips name="interests" type="checkbox" defaultValue={style.interests ?? []}
          options={["Food", "Nature", "Culture", "Shopping"].map((x) => ({ value: x.toLowerCase(), label: x }))} />
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-[11px] font-bold text-ink">Pace</legend>
        <Chips name="pace" defaultValue={style.pace ?? "balanced"}
          options={[{ value: "slow", label: "Slow" }, { value: "balanced", label: "Balanced" }, { value: "packed", label: "Packed" }]} />
      </fieldset>
      <FormMessage error={state.error} />
      <Submit pending="Finding your destination…">Next: your must-visit places</Submit>
    </form>
  );
}
