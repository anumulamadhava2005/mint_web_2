// ═══════════════════════════════════════════════════════════════
// API Repo Layer — All HTTP calls to backend
// Mirrors: frontend/src/app/main/repo.cljs
// ═══════════════════════════════════════════════════════════════

import type { PenpotFile, Page, PenpotShape, UUID, Flow } from "./types";
import type { FileChange } from "./changes";

const API_BASE = "";

async function request<T>(
  method: string,
  url: string,
  body?: any
): Promise<T> {
  const opts: RequestInit = {
    method,
    credentials: "include",
    headers: { Accept: "application/json" },
  };
  if (body && method !== "GET") {
    opts.headers = { ...opts.headers, "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API_BASE + url, opts);
  if (res.status === 204) return null as T;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ── Files ─────────────────────────────────────────────────────
export async function getFile(id: UUID) {
  return request<{ file: any }>("GET", `/api/files?id=${id}`);
}

export async function getProjectFiles(projectId: UUID) {
  return request<{ files: any[] }>("GET", `/api/files?projectId=${projectId}`);
}

export async function createFile(projectId: UUID, name: string, data?: any) {
  return request<{ file: any }>("POST", "/api/files", { projectId, name, data });
}

export async function renameFile(id: UUID, name: string) {
  return request<{ file: any }>("PUT", "/api/files", { id, name });
}

export async function deleteFile(id: UUID) {
  return request<{ ok: boolean }>("DELETE", `/api/files?id=${id}`);
}

// ── File Changes (core collaboration endpoint) ────────────────
export async function updateFile(
  fileId: UUID,
  sessionId: UUID,
  revn: number,
  changes: FileChange[]
) {
  return request<{ revn: number; laggedChanges: any[] }>(
    "POST",
    "/api/files/changes",
    { fileId, sessionId, revn, changes }
  );
}

export async function getFileChanges(fileId: UUID, fromRevn: number) {
  return request<{ changes: any[] }>(
    "GET",
    `/api/files/changes?fileId=${fileId}&fromRevn=${fromRevn}`
  );
}

// ── Viewer ────────────────────────────────────────────────────
export async function getViewerBundle(fileId: UUID, shareId?: string) {
  const params = new URLSearchParams({ fileId });
  if (shareId) params.set("shareId", shareId);
  return request<{ file: any; permissions: any }>(
    "GET",
    `/api/viewer?${params.toString()}`
  );
}

// ── Comments ──────────────────────────────────────────────────
export async function getCommentThreads(fileId: UUID) {
  return request<{ threads: any[] }>("GET", `/api/comments?fileId=${fileId}`);
}

export async function createCommentThread(data: {
  fileId: UUID;
  pageId: UUID;
  frameId?: UUID;
  positionX: number;
  positionY: number;
  content: string;
}) {
  return request<{ thread: any }>("POST", "/api/comments", data);
}

export async function replyToThread(threadId: UUID, content: string) {
  return request<{ comment: any }>("POST", "/api/comments", { threadId, content });
}

// ── Projects ──────────────────────────────────────────────────
export async function getProjects() {
  return request<{ projects: any[] }>("GET", "/api/projects");
}

export async function createProject(name: string, description?: string) {
  return request<{ project: any }>("POST", "/api/projects", { name, description });
}

// ── Auth ──────────────────────────────────────────────────────
export async function login(email: string, password: string) {
  return request<{ ok: boolean; token: string; user: any }>(
    "POST",
    "/api/login",
    { email, password }
  );
}

export async function getProfile() {
  // Get token from cookie
  const token =
    typeof document !== "undefined"
      ? document.cookie
          .split(";")
          .find((c) => c.trim().startsWith("token="))
          ?.replace(/^[^=]+=/, "")
      : null;
  if (!token) return null;
  return request<{ ok: boolean; user: any }>("POST", "/api/validate-token", { token });
}
