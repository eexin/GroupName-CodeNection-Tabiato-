"use client";

import { useEffect, useState } from "react";

/** "Export PDF" opens the browser's print-to-PDF; afterwards we point to where it went. */
export function PrintButton() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const after = () => setDone(true);
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, []);
  return (
    <div className="print:hidden">
      <button onClick={() => window.print()} className="h-12 w-full rounded-[15px] bg-coral text-[14px] font-bold text-white">Export PDF</button>
      {done && <p role="status" className="mt-2 text-center text-[12px] text-deep">If you chose “Save as PDF”, it&apos;s saved to your files.</p>}
    </div>
  );
}
