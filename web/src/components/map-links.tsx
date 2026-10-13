"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { MemoryMap, type Pin } from "@/components/memory-map";

/** A map whose pins navigate to `${base}/${id}`. */
export function LinkedMap({ pins, base, ...rest }: { pins: Pin[]; base: string } & Omit<ComponentProps<typeof MemoryMap>, "pins" | "onSelect">) {
  const router = useRouter();
  return <MemoryMap pins={pins} onSelect={(id) => router.push(`${base}/${id}`)} {...rest} />;
}
