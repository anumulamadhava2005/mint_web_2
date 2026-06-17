"use client";

import React, { useState, useRef, useCallback } from "react";
import type { FileUploadConfig } from "@/lib/runtime/components/configs";

interface FileUploadProps {
  config: FileUploadConfig;
  onUpload?: (result: UploadResult) => void;
  onError?: (error: string) => void;
  projectId?: string;
}

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export default function FileUpload({ config, onUpload, onError, projectId }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<UploadResult[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSize = config.maxSize || 10 * 1024 * 1024;
  const uploadUrl = config.uploadUrl || "/api/upload";

  const upload = useCallback(
    async (file: File) => {
      // Validate size
      if (file.size > maxSize) {
        const msg = `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: ${(maxSize / 1024 / 1024).toFixed(0)}MB`;
        setError(msg);
        onError?.(msg);
        return;
      }

      setUploading(true);
      setError(null);

      try {
        const fd = new FormData();
        fd.append("file", file);
        if (projectId) fd.append("projectId", projectId);

        const res = await fetch(uploadUrl, { method: "POST", body: fd });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Upload failed (${res.status})`);
        }

        const result: UploadResult = await res.json();
        setFiles((prev) => [...prev, result]);
        onUpload?.(result);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setError(msg);
        onError?.(msg);
      } finally {
        setUploading(false);
      }
    },
    [maxSize, uploadUrl, projectId, onUpload, onError]
  );

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const max = config.maxFiles || 1;
    const toUpload = Array.from(fileList).slice(0, max - files.length);
    toUpload.forEach(upload);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div data-testid="file-upload" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? "#3B82F6" : "#D1D5DB"}`,
          borderRadius: 8,
          padding: 24,
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "#EFF6FF" : "#FAFAFA",
          transition: "all 150ms",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>
          {uploading ? "⏳" : "📁"}
        </div>
        <div style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>
          {config.label || "Drop files here or click to upload"}
        </div>
        {config.hint && (
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
            {config.hint}
          </div>
        )}
        {config.accept && (
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
            Accepts: {config.accept}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={config.accept}
          multiple={config.multiple}
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: "none" }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: "#EF4444", fontSize: 13, marginTop: 8 }}>{error}</div>
      )}

      {/* Preview */}
      {files.length > 0 && config.previewEnabled !== false && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {files.map((f, i) => (
            <div
              key={f.url}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 6,
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                fontSize: 13,
              }}
            >
              {f.type?.startsWith("image/") ? (
                <img src={f.url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 18 }}>📄</span>
              )}
              <span style={{ flex: 1, color: "#374151" }}>{f.filename}</span>
              <span style={{ color: "#9CA3AF", fontSize: 12 }}>
                {(f.size / 1024).toFixed(1)}KB
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 14 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
