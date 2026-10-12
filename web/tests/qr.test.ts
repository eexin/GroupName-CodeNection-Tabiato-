import assert from "node:assert/strict";
import { test } from "node:test";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { handleFromScan } from "../src/features/friends/qr-parse";

/** Render a QR the way the app does, rasterise it, and decode it the way the scanner does. */
function roundTrip(text: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size, scale = 8, quiet = 4, side = (n + quiet * 2) * scale;
  const px = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!qr.modules.get(y, x)) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = (((y + quiet) * scale + dy) * side + (x + quiet) * scale + dx) * 4;
      px[i] = px[i + 1] = px[i + 2] = 0;
    }
  }
  return jsQR(px, side, side)?.data ?? null;
}

test("a friend QR made by the app is read back by the scanner", () => {
  const url = "https://tabiato-demo.vercel.app/u/eexin";
  assert.equal(roundTrip(url), url);
  assert.equal(handleFromScan(roundTrip(url)!), "eexin");
});

test("scanner only accepts Tabiato friend links", () => {
  assert.equal(handleFromScan("https://example.com/u/Max_99"), "max_99");
  assert.equal(handleFromScan("https://x.app/u/max?ref=qr"), "max");
  assert.equal(handleFromScan("https://example.com/profile/max"), null);
  assert.equal(handleFromScan("https://x.app/u/ab"), null);        // too short to be a username
  assert.equal(handleFromScan("WIFI:S:home;T:WPA;P:secret;;"), null);
});
