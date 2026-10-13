"use client";

import { useActionState } from "react";
import { createPlan, type PlanState } from "@/features/planner/actions";
import { Chips } from "@/components/chips";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/submit";
import type { TravelStyle } from "@/lib/types";
import { Ato } from "@/components/ato";

export function PlanForm({ style, suggested }: { style: TravelStyle; suggested: { pace: string | null; interests: string[] } }) {
  const [state, action] = useActionState<PlanState, FormData>(createPlan, {});
  const v = state.values;
  // what your past trips show wins over what you told us at sign-up; either way you can change it
  const fromTrips = Boolean(suggested.pace || suggested.interests.length);
  const interests = suggested.interests.length ? suggested.interests : style.interests ?? [];
  const pace = suggested.pace ?? style.pace ?? "balanced";
  return (
    // redrawn after each answer (key) so the form keeps what was typed
    <form key={state.n ?? 0} action={action} className="space-y-4">
      <Field label="Destination" name="destination" placeholder="Tokyo, Japan" required defaultValue={v?.destination} />
      {state.ask && (
        <div role="status" className="rounded-[16px] border-l-4 border-coral bg-card p-4 shadow-card">
          <div className="flex items-start gap-3">
            <Ato size={44} />
            <p className="text-[12.5px] leading-snug text-body">
              <strong className="block text-ink">{state.ask.area} is a big pond!</strong>
              I plan best around one city.{" "}
              {state.ask.cities.length ? "Where will you stay?" : "Type the city you'll stay in, like the one you fly into."}
            </p>
          </div>
          {state.ask.cities.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {state.ask.cities.map((c) => (
                <button key={c} type="submit" name="destination_pick" value={c}
                  className="min-h-[40px] rounded-full border border-line bg-surface px-4 text-[12.5px] font-bold text-deep">
                  {c.split(",")[0]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" name="start_date" type="date" required defaultValue={v?.start_date} />
        <Field label="End" name="end_date" type="date" required defaultValue={v?.end_date} />
      </div>
      <Field label="Budget (RM, optional)" name="budget" inputMode="decimal" placeholder="3000" defaultValue={v?.budget} />
      <fieldset>
        <legend className="mb-1 text-[11px] font-bold text-ink">Preferences</legend>
        {fromTrips ? (
          <p className="mb-2 flex items-center gap-2 text-[11px] text-muted">
            <Ato size={28} /><span>I picked these from your past trips. Change them for this one if you like.</span>
          </p>
        ) : (
          <p className="mb-2 text-[11px] text-muted">Pulled from your profile — tweak for this trip.</p>
        )}
        <Chips name="interests" type="checkbox" defaultValue={v?.interests ?? interests}
          options={["Food", "Nature", "Culture", "Shopping"].map((x) => ({ value: x.toLowerCase(), label: x }))} />
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-[11px] font-bold text-ink">Pace</legend>
        <Chips name="pace" defaultValue={v?.pace ?? pace}
          options={[{ value: "slow", label: "Slow" }, { value: "balanced", label: "Balanced" }, { value: "packed", label: "Packed" }]} />
      </fieldset>
      <FormMessage error={state.error} />
      <Submit pending="Finding your destination…">Next: your must-visit places</Submit>
    </form>
  );
}
