/** A printable route: the places in visit order, drawn as plain SVG (map tiles don't print reliably). */
export function RouteSketch({ points, width = 320, height = 200 }: { points: { lat: number; lng: number; name: string }[]; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const pad = 24;
  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const sx = (width - pad * 2) / Math.max(maxLng - minLng, 1e-6), sy = (height - pad * 2) / Math.max(maxLat - minLat, 1e-6);
  const s = Math.min(sx, sy);
  const xy = points.map((p) => [pad + (p.lng - minLng) * s, height - pad - (p.lat - minLat) * s] as const);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={`Route: ${points.map((p) => p.name).join(", then ")}`}>
      <rect width={width} height={height} rx="12" fill="#e2eeec" />
      <polyline points={xy.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="#0e4c55" strokeWidth="2" strokeDasharray="5 4" />
      {xy.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="9" fill="#b8402a" stroke="#fff" strokeWidth="2" />
          <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">{i + 1}</text>
        </g>
      ))}
    </svg>
  );
}
