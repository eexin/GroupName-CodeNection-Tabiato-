"use client";

import { useRouter } from "next/navigation";
import { MemoryMap, type Pin } from "@/components/memory-map";

/** A map whose pins navigate to `${base}/${id}`. */
export function LinkedMap({ pins, base, className, zoom }: { pins: Pin[]; base: string; className?: string; zoom?: number }) {
  const router = useRouter();
  return <MemoryMap pins={pins} zoom={zoom} onSelect={(id) => router.push(`${base}/${id}`)} className={className} />;
}
