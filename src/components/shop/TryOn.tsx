"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Camera, Download, RefreshCw, Loader2 } from "lucide-react";

/* Virtual try-on: button under the buy actions that opens an inline modal
   (same idiom as the ProductGallery lightbox — no layout-level provider).
   The customer's photo is downscaled client-side, sent once to /api/tryon
   and never stored; the generated preview comes back as a data URL. */

const STATUS_LINES = [
  "Reading your photo…",
  "Fitting the garment…",
  "Matching light and shadows…",
  "Almost there — rendering your look…",
];

/* Downscale to max 1280px JPEG so uploads stay small and fast. */
async function downscalePhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("bad image"));
      el.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.type === "image/jpeg") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function TryOn({ productImage, productName }: { productImage: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusIdx, setStatusIdx] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Body-scroll lock + Escape close while the modal is open (gallery idiom).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Rotate the status line while generating so the 5-20s wait feels alive.
  useEffect(() => {
    if (!generating) return;
    setStatusIdx(0);
    const t = setInterval(() => setStatusIdx((i) => Math.min(i + 1, STATUS_LINES.length - 1)), 4000);
    return () => clearInterval(t);
  }, [generating]);

  async function onPick(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    setResult(null);
    try {
      const blob = await downscalePhoto(file);
      setPhoto((old) => {
        if (old) URL.revokeObjectURL(old.preview);
        return { blob, preview: URL.createObjectURL(blob) };
      });
    } catch {
      setError("Couldn't read that photo. Please pick a different one.");
    }
  }

  async function generate() {
    if (!photo || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("photo", photo.blob, "photo.jpg");
      fd.append("productImage", productImage);
      fd.append("productName", productName);
      const res = await fetch("/api/tryon", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { image?: string; error?: string };
      if (!res.ok || !data.image) {
        setError(data.error || "Try-on failed. Please try again.");
        return;
      }
      setResult(data.image);
    } catch {
      setError("Try-on failed. Please check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-lg border border-gray-300 py-3 px-4 flex items-center justify-center gap-2 font-semibold text-gray-900 hover:border-primary hover:text-primary transition-colors"
      >
        <Sparkles className="w-5 h-5" />
        Try It On
        <span className="text-sm font-normal text-gray-500">— see how it looks on you</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 p-2 text-gray-500 hover:text-gray-900"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-gray-900 pr-8">Ready to try it on?</h2>
            <p className="text-sm text-gray-500 mt-0.5 mb-4">Upload your photo and see how it looks on you instantly.</p>

            {result ? (
              /* Result */
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result} alt={`Virtual try-on of ${productName}`} className="w-full rounded-lg" />
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <a
                    href={result}
                    download="try-on.jpg"
                    className="flex-1 rounded-lg bg-primary text-white py-3 font-semibold flex items-center justify-center gap-2 hover:bg-primary/90"
                  >
                    <Download className="w-5 h-5" /> Download
                  </a>
                  <button
                    onClick={() => setResult(null)}
                    className="flex-1 rounded-lg border border-gray-300 py-3 font-semibold text-gray-900 flex items-center justify-center gap-2 hover:border-primary hover:text-primary"
                  >
                    <RefreshCw className="w-5 h-5" /> Try another photo
                  </button>
                </div>
              </div>
            ) : generating ? (
              /* Generating */
              <div className="py-12 flex flex-col items-center text-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="mt-4 font-semibold text-gray-900">{STATUS_LINES[statusIdx]}</p>
                <p className="text-sm text-gray-500 mt-1">This usually takes 5–20 seconds.</p>
              </div>
            ) : (
              /* Pick photo */
              <div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={productImage} alt={productName} className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                    <p className="text-[11px] text-gray-500 mt-1 text-center">Product to try on</p>
                  </div>

                  <div className="flex-1">
                    {photo ? (
                      <div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.preview} alt="Your photo" className="w-full max-h-64 object-contain rounded-lg bg-gray-50 border border-gray-200" />
                        <button
                          onClick={() => fileRef.current?.click()}
                          className="mt-2 text-sm font-medium text-primary hover:underline"
                        >
                          Change photo
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-10 px-4 cursor-pointer text-center hover:border-primary transition-colors">
                        <Camera className="w-7 h-7 text-gray-400" />
                        <span className="font-semibold text-gray-900">Choose your photo</span>
                        <span className="text-xs text-gray-500">Best result: a full-body photo — try one taken in a mirror</span>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => onPick(e.target.files?.[0])}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {photo && (
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPick(e.target.files?.[0])}
                  />
                )}

                {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

                <button
                  onClick={generate}
                  disabled={!photo}
                  className="mt-4 w-full rounded-lg bg-primary text-white py-3.5 font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-5 h-5" /> Generate my look
                </button>
              </div>
            )}

            <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
              Your photo is used once to generate this preview and is never stored. AI can make
              mistakes — the result is a visualization, not an exact fit or color guarantee.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
