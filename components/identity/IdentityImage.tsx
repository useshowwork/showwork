"use client";

import { useState } from "react";
import { WORKSPACE_LOGO_DISPLAY_SCALE } from "@/lib/identityImageLimits";

export default function IdentityImage({ name, src, logo = false, className = "" }: {
  name: string;
  src?: string | null;
  logo?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase() || (logo ? "SW" : "?");
  return (
    <span aria-hidden="true" className={`inline-grid h-9 w-9 shrink-0 place-items-center overflow-hidden bg-blue-50 text-xs font-semibold text-blue-800 ${logo ? "rounded-full" : "rounded-lg"} ${className}`}>
      {src && src !== failedSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={`h-full w-full object-cover ${logo ? "bg-white" : ""}`}
          style={logo ? { transform: `scale(${WORKSPACE_LOGO_DISPLAY_SCALE})` } : undefined}
          onError={() => setFailedSrc(src)}
        />
      ) : initials}
    </span>
  );
}
