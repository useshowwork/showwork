"use client";

import { useState } from "react";

export default function IdentityImage({ name, src, logo = false, className = "" }: {
  name: string;
  src?: string | null;
  logo?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase() || (logo ? "SW" : "?");
  return (
    <span aria-hidden="true" className={`inline-grid h-9 w-9 shrink-0 place-items-center overflow-hidden bg-blue-50 text-xs font-semibold text-blue-800 rounded-lg ${className}`}>
      {src && src !== failedSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={`h-full w-full ${logo ? "bg-white object-contain p-1" : "object-cover"}`} onError={() => setFailedSrc(src)} />
      ) : initials}
    </span>
  );
}
