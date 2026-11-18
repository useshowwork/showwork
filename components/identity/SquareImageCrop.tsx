"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { IDENTITY_IMAGE_CROP_SIZE as SIZE, WORKSPACE_LOGO_DISPLAY_SCALE } from "@/lib/identityImageLimits";

const STAGE_SIZE = 704;
const FRAME_PERCENT = `${SIZE / STAGE_SIZE * 100}%`;
const MIN_ZOOM = 0.85;
const MAX_ZOOM = 4;
const CORNERS = [
  { name: "top left", x: -1, y: -1, className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
  { name: "top right", x: 1, y: -1, className: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
  { name: "bottom left", x: -1, y: 1, className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize" },
  { name: "bottom right", x: 1, y: 1, className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
] as const;

export default function SquareImageCrop({ image, logo, pending, onSave, onCancel }: {
  image: ImageBitmap;
  logo: boolean;
  pending: boolean;
  onSave: (canvas: HTMLCanvasElement) => void;
  onCancel: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const resizeStart = useRef<{ id: number; x: number; y: number; zoom: number; position: { x: number; y: number }; stageWidth: number } | null>(null);
  const controlsId = useId();
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const minimumScale = SIZE / (logo ? Math.max(image.width, image.height) : Math.min(image.width, image.height));
  const scale = minimumScale * (logo ? 0.85 : 1 / MIN_ZOOM) * zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  function panLimit(length: number) {
    return (logo ? Math.abs(length - SIZE) : Math.max(0, length - SIZE)) / 2;
  }

  const maxX = panLimit(width);
  const maxY = panLimit(height);
  const cropX = Math.min(maxX, Math.max(-maxX, position.x));
  const cropY = Math.min(maxY, Math.max(-maxY, position.y));

  function draw(target: HTMLCanvasElement, extent: number) {
    const context = target.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, extent, extent);
    context.imageSmoothingQuality = "high";
    context.drawImage(image, (extent - width) / 2 + cropX, (extent - height) / 2 + cropY, width, height);
  }

  useEffect(() => { canvas.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    if (canvas.current) draw(canvas.current, STAGE_SIZE);
  });

  function move(x: number, y: number) {
    setPosition((previous) => ({
      x: Math.min(maxX, Math.max(-maxX, previous.x + x)),
      y: Math.min(maxY, Math.max(-maxY, previous.y + y)),
    }));
  }

  function dragImage(event: PointerEvent<HTMLCanvasElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId || pending) return;
    const ratio = STAGE_SIZE / event.currentTarget.getBoundingClientRect().width;
    move((event.clientX - start.x) * ratio, (event.clientY - start.y) * ratio);
    drag.current = { id: start.id, x: event.clientX, y: event.clientY };
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLCanvasElement>) {
    const directions: Record<string, [number, number]> = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    };
    const direction = directions[event.key];
    if (!direction || pending) return;
    event.preventDefault();
    const step = event.shiftKey ? 24 : 6;
    move(direction[0] * step, direction[1] * step);
  }

  function resize(target: number, center = { x: cropX, y: cropY }) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, target));
    const ratio = next / zoom;
    const nextMaxX = panLimit(width * ratio);
    const nextMaxY = panLimit(height * ratio);
    setPosition({
      x: Math.min(nextMaxX, Math.max(-nextMaxX, center.x)),
      y: Math.min(nextMaxY, Math.max(-nextMaxY, center.y)),
    });
    setZoom(next);
  }

  return (
    <div className="mt-4 max-w-sm space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Crop {logo ? "workspace logo" : "profile photo"}</p>
        <p id={controlsId} className="mt-1 text-sm text-slate-600">Drag the image to reposition it. Drag a corner out to enlarge or in to shrink. {logo ? "The circle shows how your logo will appear." : "Only what’s inside the square will be saved."}</p>
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-72 overflow-hidden rounded-xl bg-white focus-within:ring-2 focus-within:ring-blue-700 focus-within:ring-offset-2"
        style={{ backgroundImage: "conic-gradient(#e2e8f0 25%, white 0 50%, #e2e8f0 0 75%, white 0)", backgroundSize: "16px 16px" }}>
        <canvas
          ref={canvas}
          width={STAGE_SIZE}
          height={STAGE_SIZE}
          tabIndex={0}
          aria-label="Square crop preview"
          aria-describedby={controlsId}
          onPointerDown={(event) => {
            if (pending || !event.isPrimary || event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          }}
          onPointerMove={dragImage}
          onLostPointerCapture={() => { drag.current = null; }}
          onKeyDown={moveWithKeyboard}
          className="block h-full w-full touch-none focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-white"
          style={{ cursor: pending ? "wait" : "move" }}
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white"
          style={{ width: FRAME_PERCENT, height: FRAME_PERCENT, boxShadow: "0 0 0 100vmax rgb(15 23 42 / 65%)" }}>
          {logo && (
            <div aria-hidden="true" className="absolute inset-0 grid place-items-center overflow-hidden">
              <div className="rounded-full border border-white/90"
                style={{ width: `${100 / WORKSPACE_LOGO_DISPLAY_SCALE}%`, aspectRatio: 1, boxShadow: "0 0 0 100vmax rgb(15 23 42 / 42%)" }} />
            </div>
          )}
          <div aria-hidden="true" className="absolute inset-0 grid grid-cols-3 grid-rows-3 drop-shadow-[0_0_1px_rgba(15,23,42,0.9)]">
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} className={`${index % 3 < 2 ? "border-r" : ""} ${index < 6 ? "border-b" : ""} border-white/75`} />
            ))}
          </div>
          {CORNERS.map((corner) => (
            <button
              key={corner.name}
              type="button"
              disabled={pending}
              aria-label={`Resize from ${corner.name}. Use plus or minus to resize.`}
              className={`pointer-events-auto absolute z-10 grid h-11 w-11 touch-none place-items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:cursor-wait ${corner.className}`}
              onPointerDown={(event) => {
                const stageWidth = canvas.current?.getBoundingClientRect().width;
                if (!stageWidth || !event.isPrimary || event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                resizeStart.current = {
                  id: event.pointerId, x: event.clientX, y: event.clientY,
                  zoom, position: { x: cropX, y: cropY }, stageWidth,
                };
              }}
              onPointerMove={(event) => {
                const start = resizeStart.current;
                if (!start || start.id !== event.pointerId || pending) return;
                const distance = (event.clientX - start.x) * corner.x + (event.clientY - start.y) * corner.y;
                resize(start.zoom * (1 + distance * STAGE_SIZE / (start.stageWidth * SIZE)), start.position);
              }}
              onLostPointerCapture={() => { resizeStart.current = null; }}
              onKeyDown={(event) => {
                const direction = event.key === "+" || event.key === "=" ? 1 : event.key === "-" ? -1 : 0;
                if (!direction) return;
                event.preventDefault();
                resize(zoom + direction * 0.1);
              }}
            >
              <span aria-hidden="true" className="h-4 w-4 rounded-sm border-2 border-blue-700 bg-white shadow-md" />
            </button>
          ))}
        </div>
      </div>
      <p className="text-center text-xs tabular-nums text-slate-600">{Math.round(zoom * 100)}%</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={pending} onClick={onCancel}
          className="min-h-11 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60">Cancel</button>
        <button type="button" disabled={pending} onClick={() => {
          const crop = document.createElement("canvas");
          crop.width = SIZE;
          crop.height = SIZE;
          draw(crop, SIZE);
          onSave(crop);
        }} className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
          {pending ? "Saving…" : "Save crop"}
        </button>
      </div>
    </div>
  );
}
