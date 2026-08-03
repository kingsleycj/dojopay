"use client";

import { useState } from "react";
import axios from "axios";
import { creatorEndpoints } from "@/lib/api";
import { CLOUDFRONT_URL } from "@/utils";
import { showToast } from "./Toast";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function UploadImage({
  onImageAdded,
  image,
}: {
  onImageAdded: (image: string) => void;
  image?: string;
}) {
  const [uploading, setUploading] = useState(false);

  async function onFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Only image files can be uploaded", "error");
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      showToast("That image is larger than the 50MB limit", "error");
      return;
    }

    setUploading(true);
    try {
      const { presignedUrl, fields } = await creatorEndpoints.presignedUrl();

      // Forward every field the presigner returned rather than cherry-picking a
      // fixed list — a policy change on the backend used to silently break the
      // upload here. S3 requires `file` to be appended last.
      const formData = new FormData();
      for (const [key, value] of Object.entries(fields)) {
        formData.set(key, value);
      }
      formData.set("Content-Type", file.type);
      formData.append("file", file);

      await axios.post(presignedUrl, formData);

      onImageAdded(`${CLOUDFRONT_URL}${fields.key}`);
    } catch (error: any) {
      // No silent data-URL fallback. It used to look like a successful upload,
      // then the task either failed to submit or rendered a broken image for
      // every worker who opened it.
      console.error("Image upload failed:", error);
      showToast(
        error?.message ?? "Image upload failed. Please try again.",
        "error",
      );
    } finally {
      setUploading(false);
      // Allow re-selecting the same file after a failure.
      event.target.value = "";
    }
  }

  if (image) {
    return <img className="p-2 w-96 rounded" src={image} alt="Task option" />;
  }

  return (
    <label
      className={`w-24 h-24 sm:w-32 sm:h-32 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center transition-colors ${
        uploading ? "cursor-wait bg-gray-50" : "cursor-pointer hover:border-gray-400"
      }`}
    >
      {uploading ? (
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#f97316]" />
      ) : (
        <span className="text-3xl text-gray-400" aria-hidden>
          +
        </span>
      )}
      <span className="sr-only">Add task image</span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={uploading}
        onChange={onFileSelect}
      />
    </label>
  );
}
