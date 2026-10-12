# Accessibility

Target: WCAG 2.2 AA.

**Colour contrast** — every text colour against every background it appears on is at least 4.5:1:

| Text | on white | on page | on surface |
| --- | --- | --- | --- |
| ink `#12312F` | 13.9 | 12.7 | 11.7 |
| body `#3D5C59` | 7.3 | 6.7 | 6.2 |
| muted `#536B68` (was `#7E9895`, 2.8) | 5.7 | 5.2 | 4.8 |
| coral `#B8402A` (was `#E8623F`, 3.1) | 5.5 | 5.0 | 4.7 |
| sand-ink `#86570F` (was `#E8A23F`, 2.0) | 6.2 | 5.7 | 5.2 |
| white on coral button | 5.5 | | |

**Also:** skip-to-content link; visible focus ring on every control; touch targets of at least
40 px for icon buttons; every photo has alt text; the map has a text alternative (the list under
it); form errors use `role="alert"`, progress uses `role="progressbar"`, loading uses
`role="status"`; motion is reduced when the system asks for it; the page can be zoomed.
