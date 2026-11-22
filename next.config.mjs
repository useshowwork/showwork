// Fix for Node 22/25 broken experimental web storage on SSR
if (typeof globalThis.localStorage !== 'undefined' && typeof globalThis.localStorage.getItem !== 'function') {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (key) => mem.get(String(key)) ?? null,
    setItem: (key, value) => { mem.set(String(key), String(value)); },
    removeItem: (key) => { mem.delete(String(key)); },
    clear: () => { mem.clear(); },
    key: (index) => Array.from(mem.keys())[index] ?? null,
    get length() { return mem.size; },
  };
}

import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/**": ["./node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node"],
    "/api/calendars/*/posts/*/publish": ["./.media-bin/*.gz"],
  },
  outputFileTracingExcludes: {
    "/**": ["./node_modules/.prisma/client/libquery_engine-darwin.dylib.node", "./node_modules/ffprobe-static/bin/**", "./node_modules/ffmpeg-static/ffmpeg", "./node_modules/ffmpeg-static/ffmpeg.exe"],
  },
  webpack(config, { isServer }) {
    config.output.environment = { ...config.output.environment, asyncFunction: true };
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    if (!isServer) config.resolve.fallback = { ...config.resolve.fallback, fs: false, crypto: false, module: false, url: false };
    return config;
  },
  images: {
    remotePatterns: [
      // Include the configured public media domain as well as R2's defaults.
      ...(process.env.R2_PUBLIC_URL ? (() => {
        try { const url = new URL(process.env.R2_PUBLIC_URL); return [{ protocol: url.protocol.slice(0, -1), hostname: url.hostname, port: url.port, pathname: `${url.pathname.replace(/\/$/, "")}/**` }]; }
        catch { return []; }
      })() : []),
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },
  // pdfkit reads its own font data files (Helvetica.afm, etc.) from disk
  // at runtime via fs.readFileSync. If webpack bundles it, those data
  // files don't get copied alongside the bundle and the paths break —
  // this tells Next.js to load pdfkit directly from node_modules
  // instead, where its data files actually live.
  serverExternalPackages: ["pdfkit", "sharp", "heic-convert"],
};
export default (phase) => ({
  ...nextConfig,
  // Use a separate output directory when running a second local dev server.
  distDir: phase === PHASE_DEVELOPMENT_SERVER
    ? process.env.SHOWWORK_DEV_DIST_DIR || ".next-dev"
    : ".next",
});
