"use client";

import React, { useState, useEffect, useRef } from "react";
import Button from "@/components/Button";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (project: { id: string; name: string; description: string | null; thumbnail_url: string | null }) => void;
};

export default function NewProjectDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_id", "web-client");
      formData.append("is_public", "true");

      const res = await fetch("https://api.mintit.pro/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.variants?.length > 0) {
        const highQualityUrl = data.variants.find((v: any) => v.quality === "high")?.url;
        setThumbnailUrl(highQualityUrl || data.variants[0].url);
      } else if (data.thumbnailUrl) {
         setThumbnailUrl(data.thumbnailUrl);
      } else {
        setError("Failed to upload image.");
      }
    } catch (err) {
      setError("Network error uploading image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Focus name field when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setThumbnailUrl("");
      setError("");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          thumbnail_url: thumbnailUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create project");
        setLoading(false);
        return;
      }

      const data = await res.json();
      onCreated(data.project);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md rounded-[28px] border border-black/5 bg-[#fcfaf7] p-6 shadow-[0_30px_100px_-50px_rgba(20,18,15,0.55)]">
        <h2 className="text-lg font-semibold text-[#14120f]">Create new project</h2>
        <p className="mt-1 text-sm text-[#64594c]">
          Give your project a name to get started.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="project-name"
              className="mb-1.5 block text-sm font-medium text-[#373027]"
            >
              Project name <span className="text-[#b64e45]">*</span>
            </label>
            <input
              ref={nameRef}
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing Website"
              className="w-full rounded-2xl border border-black/6 bg-white px-3 py-2.5 text-sm text-[#14120f] placeholder:text-[#aa9f92] outline-none transition-colors focus:border-black/15 focus:ring-1 focus:ring-black/5"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="project-desc"
              className="mb-1.5 block text-sm font-medium text-[#373027]"
            >
              Description{" "}
              <span className="text-[#8a7f73] font-normal">(optional)</span>
            </label>
            <textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of your project"
              rows={3}
              className="w-full resize-none rounded-2xl border border-black/6 bg-white px-3 py-2.5 text-sm text-[#14120f] placeholder:text-[#aa9f92] outline-none transition-colors focus:border-black/15 focus:ring-1 focus:ring-black/5"
            />
          </div>

          {/* Thumbnail URL */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="project-thumb"
                className="block text-sm font-medium text-[#373027]"
              >
                Thumbnail URL{" "}
                <span className="text-[#8a7f73] font-normal">(optional)</span>
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-medium text-[#6e5f4f] hover:text-[#14120f] disabled:opacity-50"
                disabled={uploadingImage}
              >
                {uploadingImage ? "Uploading..." : "Upload Image"}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            <input
              id="project-thumb"
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://example.com/image.png"
              className="w-full rounded-2xl border border-black/6 bg-white px-3 py-2.5 text-sm text-[#14120f] placeholder:text-[#aa9f92] outline-none transition-colors focus:border-black/15 focus:ring-1 focus:ring-black/5"
            />
            {thumbnailUrl.trim() && (
              <div className="mt-2 overflow-hidden rounded-2xl border border-black/6 bg-white">
                <img
                  src={thumbnailUrl}
                  alt="Preview"
                  className="h-28 w-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-[#b64e45]">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-medium text-[#6f6558] transition-colors hover:text-[#14120f]"
            >
              Cancel
            </button>
            <Button
              type="submit"
              loading={loading}
              className="w-auto rounded-full px-5 py-2.5"
            >
              Create Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
