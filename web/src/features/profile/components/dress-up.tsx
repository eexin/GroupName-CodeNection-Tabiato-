"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ato } from "@/components/ato";
import { buttonClass } from "@/components/ui";
import {
  HAIR_COLORS, HAIR_COLOR_NAMES, ITEMS, SKINS, SKIN_NAMES, SLOTS, SLOT_LABEL,
  encodeLook, randomLook, renderLook, type Look, type Slot,
} from "@/lib/character";
import { saveLook } from "@/features/profile/settings";
import { ATO_LINES } from "@/features/profile/ato-lines";

type Tab = "you" | Slot;
const TABS: Tab[] = ["you", ...SLOTS];
/** Tops, neck items and bags are tried on chest-up; everything else on the face. */
const CHEST_VIEW: Slot[] = ["clothes", "neck", "back"];
const NONE_LABEL: Partial<Record<Slot, string>> = { hair: "No hair", clothes: "Plain tee" };

/** Inline SVG from lib/character — built only from its own fixed strings, never from input. */
function Figure({ look, view, className }: { look: Look; view: "bust" | "chest" | "full"; className?: string }) {
  return <span aria-hidden className={`block ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: renderLook(look, view).replace("<svg ", "<svg width='100%' height='100%' ") }} />;
}

/** Dress up (Profile → your picture). Everything is free; one item per slot, like SEA's avatar. */
export function DressUp({ initial, usingPhoto, next }: { initial: Look; usingPhoto: boolean; next: string }) {
  const router = useRouter();
  const [look, setLook] = useState(initial);
  const [tab, setTab] = useState<Tab>("you");
  const [line, setLine] = useState(ATO_LINES.start);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const wear = (slot: Slot, key: string | undefined) => {
    setLook((l) => ({ ...l, items: { ...l.items, [slot]: key } }));
    setLine(key ? ATO_LINES[key] ?? ATO_LINES.you : ATO_LINES.none);
  };
  const save = () => startSaving(async () => {
    const r = await saveLook(encodeLook(look));
    if (r.error) { setError(r.error); return; }
    router.push(next);
    router.refresh();
  });

  const swatches = (label: string, colors: readonly string[], names: readonly string[], value: number, pick: (i: number) => void) => (
    <fieldset>
      <legend className="mb-2 text-[11px] font-bold text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2.5">
        {colors.map((c, i) => (
          <button key={c} type="button" aria-label={names[i]} aria-pressed={value === i} onClick={() => { pick(i); setLine(ATO_LINES.you); }}
            className={`h-10 w-10 rounded-full ring-offset-2 ring-offset-paper ${value === i ? "ring-[3px] ring-coral" : "ring-1 ring-line"}`}
            style={{ background: c }} />
        ))}
      </div>
    </fieldset>
  );

  const slot = tab === "you" ? null : tab;
  const options = slot ? [undefined, ...Object.keys(ITEMS).filter((k) => ITEMS[k].slot === slot)] : [];

  return (
    <div className="pb-[calc(96px+env(safe-area-inset-bottom))] wide:grid wide:grid-cols-[minmax(0,300px)_minmax(0,1fr)] wide:items-start wide:gap-6 wide:px-6 wide:pb-10">
      {/* wide: the character stays in view on the left while you pick on the right */}
      <section className="mx-6 rounded-[24px] wide:sticky wide:top-4 wide:mx-0 bg-gradient-to-b from-[#17707a] to-deeper px-5 pb-5 pt-4 text-white">
        <Figure look={look} view="full" className="mx-auto h-[220px] w-[184px] land:h-[160px] land:w-[134px]" />
        <div className="mt-3 flex items-end gap-2">
          <Ato size={54} mood="happy" />
          <p role="status" className="relative flex-1 rounded-[16px] rounded-bl-[4px] bg-card px-3.5 py-2.5 text-[12.5px] leading-snug text-ink">{line}</p>
        </div>
      </section>

      <div className="min-w-0">
      <nav aria-label="What to change" className="mt-4 wide:mt-0 flex gap-2 overflow-x-auto px-6 pb-1 no-scrollbar">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t}
            className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-full px-4 text-[12.5px] ${tab === t ? "bg-deep font-bold text-white" : "border border-line bg-card text-body"}`}>
            {t === "you" ? "You" : SLOT_LABEL[t]}
          </button>
        ))}
      </nav>

      <div className="mt-4 px-6 wide:px-0">
        {slot === null ? (
          <div className="space-y-5">
            {swatches("Skin tone", SKINS, SKIN_NAMES, look.skin, (i) => setLook((l) => ({ ...l, skin: i })))}
            {swatches("Hair colour", HAIR_COLORS, HAIR_COLOR_NAMES, look.hairColor, (i) => setLook((l) => ({ ...l, hairColor: i })))}
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-3">
            {options.map((key) => {
              const on = look.items[slot] === key;
              const preview: Look = { ...look, items: { ...look.items, [slot]: key } };
              return (
                <li key={key ?? "none"}>
                  <button type="button" aria-pressed={on} onClick={() => wear(slot, key)}
                    className={`block w-full rounded-[16px] bg-card p-2 text-center shadow-card ${on ? "ring-[2.5px] ring-coral" : ""}`}>
                    <Figure look={preview} view={CHEST_VIEW.includes(slot) ? "chest" : "bust"} className="mx-auto aspect-square w-full overflow-hidden rounded-[12px]" />
                    <span className={`mt-1.5 block truncate text-[11px] ${on ? "font-bold text-ink" : "text-body"}`}>
                      {key ? ITEMS[key].name : NONE_LABEL[slot] ?? "None"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {usingPhoto && <p className="mt-5 text-[11.5px] text-muted">Saving switches your profile picture from your photo to this character. Your photo stays saved, so you can switch back on Profile.</p>}
        {error && <p role="alert" className="mt-3 text-[12px] font-bold text-coral">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur wide:static wide:mt-6 wide:border-0 wide:bg-transparent wide:p-0 wide:backdrop-blur-none">
        <div className="mx-auto flex max-w-[430px] gap-3 wide:mx-0 wide:max-w-md">
          <button type="button" onClick={() => { setLook(randomLook()); setLine(ATO_LINES.surprise); }} className={buttonClass("quiet", "flex-1")}>Surprise me</button>
          <button type="button" onClick={save} disabled={saving} className={buttonClass("primary", "flex-[1.4]")}>{saving ? "Saving…" : "Save my look"}</button>
        </div>
      </div>
      </div>
    </div>
  );
}
