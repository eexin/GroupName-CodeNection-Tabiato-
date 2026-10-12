/** Radio/checkbox chips from Figma 04 — real form inputs, styled. */
export function Chips({
  name, options, type = "radio", defaultValue,
}: {
  name: string;
  options: { value: string; label: string }[];
  type?: "radio" | "checkbox";
  defaultValue?: string | string[];
}) {
  const selected = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.value}
          className="cursor-pointer rounded-full border border-line bg-card px-4 py-2 text-[12.5px] font-medium text-body transition-colors has-[:checked]:border-coral has-[:checked]:bg-coral has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-coral">
          <input type={type} name={name} value={o.value} defaultChecked={selected.includes(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}
