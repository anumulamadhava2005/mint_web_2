// ═══════════════════════════════════════════════════════════════
// Commit API — Accepts design nodes, generates code, stores commit
//
// POST /api/commit — editor sends nodes + framework → generates code
// GET  /api/commit — commit history
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "@/lib/auth";
import db from "@/lib/db";
import { convertDesign } from "@/lib/convert";
import type { TargetFramework } from "@/lib/convert/types";

const VALID_FRAMEWORKS: TargetFramework[] = [
  "react", "nextjs", "vue", "svelte", "react-native", "flutter", "html",
];

// POST /api/commit
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      projectId,
      fileId,
      targetFramework = "react",
      fileName = "design-export",
      nodes,
      referenceFrame,
      interactions = [],
    } = body;

    if (!projectId || !fileId) {
      return NextResponse.json({ error: "projectId and fileId required" }, { status: 400 });
    }
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json({ error: "No design nodes provided" }, { status: 400 });
    }
    if (!VALID_FRAMEWORKS.includes(targetFramework as TargetFramework)) {
      return NextResponse.json({ error: `Invalid framework: ${targetFramework}` }, { status: 400 });
    }

    // Verify project ownership
    const projRes = await db.query(
      "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
      [projectId, user.id]
    );
    if (projRes.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Run code conversion with the nodes sent by the client
    const conversionResult = await convertDesign({
      target: targetFramework as TargetFramework,
      fileName: fileName.replace(/\s+/g, "-").toLowerCase(),
      nodes,
      referenceFrame,
      interactions,
      options: {
        generateTypeScript: true,
        cssFramework: "tailwind",
        includeComments: true,
        enableLiveSync: false, // sync files are only in the initial ZIP
      },
    });

    if (!conversionResult.success) {
      return NextResponse.json(
        { error: "Code generation failed", details: conversionResult.errors },
        { status: 500 }
      );
    }

    // Next version number
    const versionRes = await db.query(
      "SELECT COALESCE(MAX(version), 0) as max_version FROM project_commits WHERE project_id = $1",
      [projectId]
    );
    const nextVersion = parseInt(versionRes.rows[0].max_version, 10) + 1;

    // Only store text files for code sync
    const codeFiles = conversionResult.files
      .filter((f) => f.type === "text")
      .map((f) => ({ path: f.path, content: f.content as string, type: f.type }));

    const commitData = {
      framework: targetFramework,
      fileCount: codeFiles.length,
      files: codeFiles,
      warnings: conversionResult.warnings,
    };

    await db.query(
      `INSERT INTO project_commits (project_id, version, config_json, committed_by, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [projectId, nextVersion, JSON.stringify(commitData), user.id, body.message || ""]
    );

    return NextResponse.json({
      version: nextVersion,
      framework: targetFramework,
      fileCount: codeFiles.length,
      files: codeFiles,
      warnings: conversionResult.warnings,
      committedAt: new Date().toISOString(),
    }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/commit error:", e);
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}

// GET /api/commit?projectId=...&version=N
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const version = searchParams.get("version");

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const projRes = await db.query(
      "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
      [projectId, user.id]
    );
    if (projRes.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (version) {
      const res = await db.query(
        `SELECT id, version, config_json, committed_by, message, created_at
         FROM project_commits WHERE project_id = $1 AND version = $2`,
        [projectId, parseInt(version, 10)]
      );
      if (res.rows.length === 0) {
        return NextResponse.json({ error: "Version not found" }, { status: 404 });
      }
      return NextResponse.json({ commit: res.rows[0] });
    }

    const res = await db.query(
      `SELECT id, version, committed_by, message, created_at,
              config_json->>'framework' as framework,
              (config_json->>'fileCount')::int as file_count
       FROM project_commits WHERE project_id = $1
       ORDER BY version DESC LIMIT 50`,
      [projectId]
    );
    return NextResponse.json({ commits: res.rows });
  } catch (e) {
    console.error("GET /api/commit error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
