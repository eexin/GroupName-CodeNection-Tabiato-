/**
 * Ato — the Tabiato goldfish. Same geometry as the "Ato / goldfish" component in Figma.
 * Ato is the voice of every AI output in the app, so use it wherever the AI is speaking.
 */

type Mood = "open" | "happy" | "rest";

type AtoProps = {
  size?: number;          // rendered width in px
  mood?: Mood;
  className?: string;
  title?: string;         // pass a title when the fish carries meaning; omit when decorative
};

const BODY =
  "M106 100 C104 62 122 32 152 30 C188 28 216 64 226 98 C229 104 228 110 223 114 " +
  "C208 142 186 168 154 168 C124 168 106 138 106 100 Z";

const MOUTH: Record<Mood, string> = {
  open: "M166 132c3.5 5 9.5 5 13 0",
  happy: "M164 130c4.5 8 12.5 8 17 0",
  rest: "M166 132c3.5 4 9.5 4 13 0",
};

function Eyes({ mood }: { mood: Mood }) {
  if (mood === "happy") {
    return (
      <g fill="none" stroke="#12312F" strokeWidth={5.5} strokeLinecap="round">
        <path d="M138 96c6-12 18-12 24 0" />
        <path d="M179 90c5.5-11 16.5-11 22 0" />
      </g>
    );
  }
  if (mood === "rest") {
    return (
      <g fill="none" stroke="#12312F" strokeWidth={5} strokeLinecap="round">
        <path d="M138 92c6 8 18 8 24 0" />
        <path d="M179 86c5.5 7 16.5 7 22 0" />
      </g>
    );
  }
  return (
    <g>
      <circle cx={150} cy={90} r={19} fill="#FFFFFF" />
      <circle cx={190} cy={84} r={16} fill="#FFFFFF" />
      <circle cx={153} cy={93} r={11} fill="#12312F" />
      <circle cx={192} cy={87} r={10} fill="#12312F" />
      <circle cx={157.5} cy={88} r={4.2} fill="#FFFFFF" />
      <circle cx={196} cy={82} r={3.8} fill="#FFFFFF" />
    </g>
  );
}

export function Ato({ size = 64, mood = "open", className, title }: AtoProps) {
  const height = (size * 194) / 268;
  return (
    <svg
      viewBox="-16 6 268 194"
      width={size}
      height={height}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <g fill="#F9AE8C" opacity={0.92}>
        <ellipse cx={62} cy={100} rx={56} ry={25} transform="rotate(-33 114 100)" />
        <ellipse cx={62} cy={100} rx={56} ry={25} transform="rotate(33 114 100)" />
        <ellipse cx={56} cy={100} rx={60} ry={23} />
      </g>
      <g fill="#C94A2C">
        <ellipse cx={158} cy={48} rx={38} ry={16} transform="rotate(-24 158 48)" />
        <ellipse cx={150} cy={158} rx={24} ry={11} transform="rotate(22 150 158)" />
        <ellipse cx={180} cy={152} rx={20} ry={10} transform="rotate(26 180 152)" />
      </g>
      <path d={BODY} fill="#E8623F" />
      <ellipse cx={134} cy={128} rx={13} ry={8} fill="#F58A6B" opacity={0.7} />
      <ellipse cx={196} cy={112} rx={11} ry={7} fill="#F58A6B" opacity={0.5} />
      <Eyes mood={mood} />
      <path d={MOUTH[mood]} fill="none" stroke="#12312F" strokeWidth={4.4} strokeLinecap="round" />
    </svg>
  );
}
