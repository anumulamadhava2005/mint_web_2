import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import db from "@/lib/db";

// ── Config ───────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "text/csv", "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel", // xls
];
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// ── POST /api/upload ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}` },
        { status: 400 }
      );
    }

    // Scope uploads to real projects. The endpoint stays public (no session),
    // but a valid, existing projectId is required so it can't be abused as
    // anonymous open file storage.
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    let projectExists = false;
    try {
      const res = await db.query("SELECT id FROM projects WHERE id = $1 LIMIT 1", [projectId]);
      projectExists = !!(res.rows && res.rows.length > 0);
    } catch {
      // Malformed id (e.g. not a uuid) or DB error — treat as not found.
      projectExists = false;
    }
    if (!projectExists) {
      return NextResponse.json({ error: "Unknown project" }, { status: 404 });
    }

    // Create upload directory
    const projectDir = projectId
      ? path.join(UPLOAD_DIR, projectId)
      : UPLOAD_DIR;

    if (!existsSync(projectDir)) {
      await mkdir(projectDir, { recursive: true });
    }

    // Generate unique filename
    const ext = path.extname(file.name) || mimeToExt(file.type);
    const hash = crypto.randomBytes(8).toString("hex");
    const timestamp = Date.now();
    const safeName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .replace(/_{2,}/g, "_")
      .slice(0, 50);
    const filename = `${timestamp}_${hash}_${safeName}`;

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(projectDir, filename);
    await writeFile(filePath, buffer);

    // Generate public URL
    const publicPath = projectId
      ? `/uploads/${projectId}/${filename}`
      : `/uploads/${filename}`;

    return NextResponse.json({
      url: publicPath,
      filename: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Upload] Error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

// ── GET /api/upload — list uploads for a project ─────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const projectDir = path.join(UPLOAD_DIR, projectId);
  if (!existsSync(projectDir)) {
    return NextResponse.json({ files: [] });
  }

  const { readdir, stat } = await import("fs/promises");
  const files = await readdir(projectDir);
  const fileInfos = await Promise.all(
    files.map(async (f) => {
      const s = await stat(path.join(projectDir, f));
      return {
        filename: f,
        url: `/uploads/${projectId}/${f}`,
        size: s.size,
        uploadedAt: s.mtime.toISOString(),
      };
    })
  );

  return NextResponse.json({ files: fileInfos });
}

// ── Helpers ──────────────────────────────────────────────────

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "application/pdf": ".pdf",
    "text/csv": ".csv",
    "text/plain": ".txt",
  };
  return map[mime] || ".bin";
}
