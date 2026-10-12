"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { createTripForm, setCover, updateTrip, type CreateResult } from "@/features/trips/actions";
import { Avatar, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/submit";
import { prepareImage } from "@/lib/image";
import type { Person } from "@/lib/people";
import { createClient } from "@/lib/supabase/client";

type Initial = { id: string; name: string; destination: string | null; start_date: string | null; end_date: string | null; is_public: boolean; coverUrl: string | null };

/** Figma 16 New memory trip and "edit trip" — one form. */
export function TripForm({ friends, members = [], initial }: { friends: Person[]; members?: string[]; initial?: Initial }) {
  const router = useRouter();
  const action = initial ? updateTrip.bind(null, initial.id) : createTripForm;
  const [state, formAction] = useActionState<CreateResult, FormData>(action, {});
  const [cover, setCoverFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial?.coverUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const handled = useRef<string | null>(null);

  // after the trip is saved: upload the cover (if one was picked), then open the trip
  useEffect(() => {
    if (!state.id || handled.current === state.id) return;
    handled.current = state.id;
    const id = state.id;
    (async () => {
      if (cover) {
        setUploading(true);
        try {
          const { blob } = await prepareImage(cover, 1600);
          const path = `${id}/cover-${crypto.randomUUID()}.jpg`;
          const up = await createClient().storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
          if (!up.error) await setCover(id, path);
        } finally {
          setUploading(false);
        }
      }
      router.push(`/trips/${id}`);
      router.refresh();
    })();
  }, [state.id, cover, router]);

  return (
    <form action={formAction} className="space-y-4">
      <label className="relative flex h-36 cursor-pointer items-center justify-center overflow-hidden rounded-[20px] border-2 border-dashed border-line bg-surface">
        {preview
          ? <img src={preview} alt="Trip cover" className="absolute inset-0 h-full w-full object-cover" />
          : <span className="text-[13px] font-bold text-deep">+ Add cover</span>}
        {preview && <span className="absolute bottom-2 right-2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-ink">Change cover</span>}
        <input type="file" accept="image/*,.heic,.heif" className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCoverFile(f); setPreview(URL.createObjectURL(f)); } }} />
      </label>

      <Field label="Trip name" name="name" defaultValue={initial?.name} placeholder="Tokyo autumn" maxLength={60} required />
      <Field label="Destination" name="destination" defaultValue={initial?.destination ?? ""} placeholder="Tokyo, Japan" maxLength={80} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" name="start_date" type="date" defaultValue={initial?.start_date ?? ""} />
        <Field label="End" name="end_date" type="date" defaultValue={initial?.end_date ?? ""} />
      </div>

      <fieldset>
        <legend className="mb-1 text-[11px] font-bold text-ink">Travel with</legend>
        <p className="mb-2 text-[11px] text-muted">They can add photos too</p>
        {friends.length === 0 ? (
          <p className="rounded-[14px] bg-surface px-4 py-3 text-[12px] text-body">Add friends first, then invite them from the trip.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {friends.map((f) => {
              const already = members.includes(f.id);
              return (
                <label key={f.id} className={`flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3 text-[12.5px] text-body has-[:checked]:border-coral has-[:checked]:bg-[#b8402a14] ${already ? "opacity-60" : "cursor-pointer"}`}>
                  <input type="checkbox" name="friends" value={f.id} disabled={already} className="sr-only" />
                  <Avatar p={f} size={32} />
                  {f.name}{already ? " · on trip" : ""}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      <h3 className="-mb-2 text-[11px] font-bold text-ink">Visibility</h3>
      <label className="flex items-center justify-between rounded-[18px] bg-card p-4 shadow-card">
        <span>
          <span className="block text-[13.5px] font-medium text-ink">Share to Community</span>
          <span className="block text-[11px] text-muted">Off — only you and invited friends</span>
        </span>
        <input type="checkbox" name="is_public" defaultChecked={initial?.is_public} className="peer sr-only" />
        <span aria-hidden className="relative h-7 w-12 shrink-0 rounded-full bg-surface transition-colors peer-checked:bg-coral peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-coral after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
      </label>

      <FormMessage error={state.error} message={uploading ? "Uploading your cover…" : undefined} />
      <Submit pending="Saving…">{initial ? "Save trip" : "Create trip"}</Submit>
    </form>
  );
}
