"use client";

import { useState } from "react";
import { Star, ImagePlus, X, Loader2, CheckCircle2 } from "lucide-react";
import { submitProductReview } from "@/app/(shop)/product/[slug]/review-actions";

/* Public "Write a review" form shown on the PDP. Anyone can submit; the review
   is saved unpublished and appears only after an admin approves it. Photos are
   uploaded to the shared /api/upload (reviews folder) and passed as URLs. */
export default function ReviewForm({
  productId,
  onCancel,
}: {
  productId: string;
  onCancel?: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const remaining = 5 - images.length;
      for (const f of Array.from(files).slice(0, remaining)) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("folder", "reviews");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setImages((prev) => [...prev, data.url]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (rating < 1) {
      setError("Please choose a star rating.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitProductReview({ productId, customerName: name, rating, message, images });
      if (result.ok) {
        setDone(true);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
        <p className="font-semibold text-gray-900">Thanks for your review!</p>
        <p className="text-sm text-gray-600 mt-1">
          It will appear on this page once our team has approved it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
      <h3 className="text-base font-bold text-gray-900 mb-4">Write a review</h3>

      {/* Star rating input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Your rating</label>
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              className="p-0.5 outline-none [-webkit-tap-highlight-color:transparent]"
            >
              <Star
                className={`w-7 h-7 transition-colors ${
                  n <= (hover || rating) ? "fill-amber-400 text-amber-400" : "text-gray-300"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="e.g. Nimal P."
            className="w-full bg-white rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Your review</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="What did you like? How was the fit, quality and print?"
            className="w-full bg-white rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
          />
        </div>
      </div>

      {/* Optional photos */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Add photos (optional)</label>
        <div className="flex flex-wrap items-center gap-2">
          {images.map((url) => (
            <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Review photo" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                aria-label="Remove photo"
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {images.length < 5 && (
            <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-600 cursor-pointer">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  upload(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || uploading}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white font-semibold px-6 py-3 hover:bg-black disabled:opacity-60 transition-colors"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? "Submitting..." : "Submit review"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-gray-500 hover:text-gray-800">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
