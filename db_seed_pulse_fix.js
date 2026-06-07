/**
 * ═══════════════════════════════════════════════════════════════
 * Pulse Design — Database Fix Seed
 *
 * Fixes 5 errors:
 * 1. "invalid input syntax for type uuid: ''"
 *    → Insert a real user + set default user.id in state
 * 2. "column muscle_group does not exist" (on workouts table)
 *    → Add muscle_group column to workouts table
 * 3. "operator does not exist: text = integer" (goals)
 *    → Cast target_value/current_value to numeric in SQL
 * 4. "function sum(text) does not exist" (activity_logs.distance)
 *    → Cast distance to numeric in SQL
 * 5. Updates all action configs in runtime_schemas
 * ═══════════════════════════════════════════════════════════════
 */

const { Client } = require("pg");
const crypto = require("crypto");

const PID = "88c00748-ef23-4aa5-b8a9-3f2c6ab13528";
const DB_URL = "postgresql://postgres:9989882989@m@localhost:5432/mint_web";
const TABLE_PREFIX = "mint_proj_88c00748ef234aa5b8a93f2c6ab13528_";

// Default user UUID — deterministic so re-runs are idempotent
const DEFAULT_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log("Connected to DB...");

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Fix actual database table schemas
  // ═══════════════════════════════════════════════════════════

  console.log("\n── Step 1: Fixing database table schemas ──");

  // 1a. Add muscle_group column to workouts if missing
  const muscleColCheck = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = '${TABLE_PREFIX}workouts' AND column_name = 'muscle_group'
  `);
  if (muscleColCheck.rows.length === 0) {
    await client.query(`ALTER TABLE "${TABLE_PREFIX}workouts" ADD COLUMN muscle_group text`);
    console.log("  ✓ Added muscle_group column to workouts table");
  } else {
    console.log("  · muscle_group column already exists on workouts");
  }

  // 1b. Cast goals.target_value and current_value from text to numeric
  const goalColCheck = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = '${TABLE_PREFIX}goals' AND column_name IN ('target_value', 'current_value')
    ORDER BY column_name
  `);
  for (const col of goalColCheck.rows) {
    if (col.data_type === "text") {
      await client.query(`
        ALTER TABLE "${TABLE_PREFIX}goals"
        ALTER COLUMN ${col.column_name} TYPE numeric
        USING CASE WHEN ${col.column_name} IS NOT NULL AND ${col.column_name} != ''
                   THEN ${col.column_name}::numeric ELSE NULL END
      `);
      console.log(`  ✓ Cast goals.${col.column_name} from text to numeric`);
    } else {
      console.log(`  · goals.${col.column_name} is already ${col.data_type}`);
    }
  }

  // 1c. Cast activity_logs.distance from text to numeric
  const distColCheck = await client.query(`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = '${TABLE_PREFIX}activity_logs' AND column_name = 'distance'
  `);
  if (distColCheck.rows.length && distColCheck.rows[0].data_type === "text") {
    await client.query(`
      ALTER TABLE "${TABLE_PREFIX}activity_logs"
      ALTER COLUMN distance TYPE numeric
      USING CASE WHEN distance IS NOT NULL AND distance != ''
                 THEN distance::numeric ELSE NULL END
    `);
    console.log("  ✓ Cast activity_logs.distance from text to numeric");
  } else {
    console.log("  · activity_logs.distance is already numeric (or doesn't exist)");
  }

  // 1d. Cast users.height_cm and weight_kg from text to numeric
  const userColCheck = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = '${TABLE_PREFIX}users' AND column_name IN ('height_cm', 'weight_kg')
    ORDER BY column_name
  `);
  for (const col of userColCheck.rows) {
    if (col.data_type === "text") {
      await client.query(`
        ALTER TABLE "${TABLE_PREFIX}users"
        ALTER COLUMN ${col.column_name} TYPE numeric
        USING CASE WHEN ${col.column_name} IS NOT NULL AND ${col.column_name} != ''
                   THEN ${col.column_name}::numeric ELSE NULL END
      `);
      console.log(`  ✓ Cast users.${col.column_name} from text to numeric`);
    } else {
      console.log(`  · users.${col.column_name} is already ${col.data_type}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Insert default user if not exists
  // ═══════════════════════════════════════════════════════════

  console.log("\n── Step 2: Ensuring default user exists ──");

  const userCheck = await client.query(
    `SELECT id FROM "${TABLE_PREFIX}users" WHERE id = $1`, [DEFAULT_USER_ID]
  );
  if (userCheck.rows.length === 0) {
    await client.query(`
      INSERT INTO "${TABLE_PREFIX}users" (id, email, name, height_cm, weight_kg)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING
    `, [DEFAULT_USER_ID, "manimadhava43@gmail.com", "Madhava", 178, 72]);
    console.log(`  ✓ Inserted default user: ${DEFAULT_USER_ID}`);
  } else {
    console.log(`  · Default user already exists: ${DEFAULT_USER_ID}`);
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Update runtime schema with fixed action configs
  // ═══════════════════════════════════════════════════════════

  console.log("\n── Step 3: Updating runtime schema action configs ──");

  const schemaRes = await client.query(
    "SELECT * FROM runtime_schemas WHERE project_id = $1 LIMIT 1", [PID]
  );

  if (!schemaRes.rows.length) {
    console.error("  ✗ No runtime_schemas row found for project", PID);
    console.error("    Run db_seed_pulse.js first to create the initial schema.");
    await client.end();
    process.exit(1);
  }

  const schemaRow = schemaRes.rows[0];
  const schema = typeof schemaRow.schema_json === "string"
    ? JSON.parse(schemaRow.schema_json)
    : schemaRow.schema_json;

  // ── Fix globalState: set default user.id to a real UUID ──
  if (schema.globalState) {
    for (const s of schema.globalState) {
      if (s.name === "user" && s.defaultValue) {
        s.defaultValue.id = DEFAULT_USER_ID;
        console.log("  ✓ Fixed user.id default value to", DEFAULT_USER_ID);
      }
    }
  }

  // ── Fix database schema definition ──
  if (schema.database && schema.database.tables) {
    for (const table of schema.database.tables) {
      if (table.name === "goals") {
        for (const field of table.fields) {
          if (field.name === "target_value" || field.name === "current_value") {
            field.type = "numeric";
          }
        }
        console.log("  ✓ Fixed goals table schema: target_value/current_value → numeric");
      }
      if (table.name === "activity_logs") {
        for (const field of table.fields) {
          if (field.name === "distance") {
            field.type = "numeric";
          }
        }
        console.log("  ✓ Fixed activity_logs table schema: distance → numeric");
      }
      if (table.name === "users") {
        for (const field of table.fields) {
          if (field.name === "height_cm" || field.name === "weight_kg") {
            field.type = "numeric";
          }
        }
        console.log("  ✓ Fixed users table schema: height_cm/weight_kg → numeric");
      }
    }
  }

  // ── Fix globalActions: update SQL queries ──
  if (schema.globalActions) {
    const fixes = {
      fetchWorkouts: {
        sql: "SELECT id, name, description, duration_minutes, calories_burned, muscle_group, created_at FROM workouts WHERE user_id = $1 ORDER BY created_at DESC",
        note: "muscle_group column now exists"
      },
      fetchRecentWorkouts: {
        sql: "SELECT id, name, description, duration_minutes, calories_burned, muscle_group, created_at FROM workouts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5",
        note: "muscle_group column now exists"
      },
      fetchGoals: {
        sql: `SELECT *, ROUND((current_value::numeric / NULLIF(target_value::numeric, 0)) * 100) AS pct_complete
                    FROM goals WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC`,
        note: "added ::numeric casts for text→numeric columns"
      },
      fetchTodayActivity: {
        sql: `SELECT COALESCE(SUM(steps),0) AS steps, COALESCE(SUM(calories),0) AS calories,
                    COALESCE(SUM(distance::numeric),0) AS distance
                    FROM activity_logs WHERE user_id = $1 AND logged_at::date = CURRENT_DATE`,
        note: "added ::numeric cast on distance"
      },
      fetchAnalytics: {
        sql: `SELECT COUNT(*) AS total_workouts,
                    COALESCE(SUM(calories_burned),0) AS calories_burned,
                    COALESCE(ROUND(SUM(duration_minutes)/60.0),0) AS hours,
                    (SELECT COUNT(DISTINCT date_trunc('day', created_at))
                     FROM workouts WHERE user_id = $1
                     AND created_at > now() - interval '30 days') AS streak
                    FROM workouts WHERE user_id = $1`,
        note: "no SQL changes needed — was failing due to empty UUID"
      },
      fetchWeeklyWorkouts: {
        sql: `SELECT date_trunc('day', created_at) AS day, COUNT(*) AS count
                    FROM workouts WHERE user_id = $1 AND created_at > now() - interval '7 days'
                    GROUP BY day ORDER BY day`,
        note: "no SQL changes needed — was failing due to empty UUID"
      }
    };

    for (const action of schema.globalActions) {
      const fix = fixes[action.name];
      if (fix) {
        // Update SQL in whichever location it exists
        if (action.config?.body?.sql) {
          action.config.body.sql = fix.sql;
        } else if (action.config?.sql) {
          action.config.sql = fix.sql;
        }
        console.log(`  ✓ Fixed ${action.name}: ${fix.note}`);
      }
    }
  }

  // ── Save updated schema ──
  await client.query(
    `UPDATE runtime_schemas SET schema_json = $1, updated_at = now() WHERE project_id = $2`,
    [JSON.stringify(schema), PID]
  );
  console.log("  ✓ Runtime schema saved");

  // ═══════════════════════════════════════════════════════════
  // STEP 4: Trigger a re-commit so the connector picks up changes
  // ═══════════════════════════════════════════════════════════

  console.log("\n── Step 4: Triggering re-commit ──");

  // Get the file data
  const fileRes = await client.query("SELECT * FROM files WHERE project_id = $1 LIMIT 1", [PID]);
  if (!fileRes.rows.length) {
    console.log("  ⚠ No file found, skipping commit");
    await client.end();
    return;
  }

  const fileRow = fileRes.rows[0];
  const fileData = fileRow.data;
  const pageId = fileData.pages[0];
  const objects = fileData.pagesIndex[pageId].objects;

  // Build nodes for commit
  const rootShapes = objects["00000000-0000-0000-0000-000000000000"]?.shapes || [];
  const topFrameIds = rootShapes.filter(id => objects[id]?.type === "frame");

  function shapeToNode(shape, parentX, parentY) {
    const r = (n) => Math.round(n * 10) / 10;
    const node = {
      id: shape.id, name: shape.name,
      type: mapShapeType(shape.type),
      x: r(shape.x - parentX), y: r(shape.y - parentY),
      width: r(shape.width), height: r(shape.height),
      visible: !shape.hidden,
    };
    if (shape.rotation) node.rotation = shape.rotation;
    if (shape.opacity !== undefined && shape.opacity !== 1) node.opacity = shape.opacity;
    if (shape.fills?.length) {
      node.fills = shape.fills.map(f => ({ type: "SOLID", color: f.fillColor, opacity: f.fillOpacity }));
    }
    if (shape.strokes?.length) {
      node.strokes = shape.strokes.map(s => ({
        color: s.strokeColor, opacity: s.strokeOpacity,
        weight: s.strokeWidth, align: s.strokeAlignment?.toUpperCase() || "CENTER"
      }));
    }
    if (shape.rx || shape.ry) node.corners = { uniform: shape.rx || shape.ry };
    if (shape.type === "text" && shape.content) {
      const textVal = shape.content.children
        ? shape.content.children.flatMap(p => p.children ? p.children.map(r => r.text) : []).join("\n")
        : "";
      const firstRun = shape.content.children?.[0]?.children?.[0];
      node.text = {
        characters: textVal,
        fontFamily: firstRun?.fontFamily || "Inter",
        fontSize: firstRun?.fontSize || 14,
        fontWeight: firstRun?.fontWeight || 400,
        color: firstRun?.fill || "#ffffff",
      };
    }
    if (shape.layoutProps?.layout) {
      const lp = shape.layoutProps;
      node.layout = {
        mode: lp.layout === "flex" ? (lp.layoutFlexDir === "column" ? "VERTICAL" : "HORIZONTAL") : "NONE",
        gap: lp.layoutGap,
        paddingTop: lp.layoutPaddingTop, paddingRight: lp.layoutPaddingRight,
        paddingBottom: lp.layoutPaddingBottom, paddingLeft: lp.layoutPaddingLeft,
      };
    }
    if (shape.shapes?.length) {
      const kids = shape.shapes.map(id => objects[id]).filter(s => !!s && !s.hidden);
      if (kids.length > 0) {
        node.children = kids.map(k => shapeToNode(k, shape.x, shape.y));
      }
    }
    if (shape.runtimeBindings) node.pluginData = { runtimeBindings: shape.runtimeBindings };
    return node;
  }

  function mapShapeType(kind) {
    return { frame: "FRAME", group: "GROUP", rect: "RECTANGLE", circle: "ELLIPSE", text: "TEXT" }[kind] || "FRAME";
  }

  const nodes = topFrameIds.map(id => {
    const f = objects[id];
    return shapeToNode(f, f.x, f.y);
  });

  // Get auth token
  let userRes = await client.query("SELECT id FROM users WHERE email = 'manimadhava43@gmail.com' LIMIT 1");
  let userId;
  if (!userRes.rows.length) {
    userId = crypto.randomUUID();
    await client.query(
      "INSERT INTO users (id, email, password_hash, salt) VALUES ($1, $2, $3, $4)",
      [userId, "manimadhava43@gmail.com", "dummyhash", "dummysalt"]
    );
  } else {
    userId = userRes.rows[0].id;
  }

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await client.query(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [sessionToken, userId, expiresAt]
  );

  await client.end();

  const body = {
    projectId: PID,
    fileId: fileRow.id,
    targetFramework: "nextjs",
    fileName: "pulse-fitness-tracker",
    nodes,
    interactions: [],
    runtimeSchema: schema,
    message: "Pulse fix — DB schema fixes (muscle_group, text→numeric casts, default user UUID)"
  };

  console.log("  Committing to http://localhost:3001/api/commit...");
  try {
    const response = await fetch("http://localhost:3001/api/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": `token=${sessionToken}` },
      body: JSON.stringify(body)
    });
    const resData = await response.json();
    console.log("  Commit status:", response.status);
    if (response.status === 201) {
      console.log("  ✓ Commit successful! The mint-connector will pick up the fix.");
    } else {
      console.log("  ⚠ Commit response:", JSON.stringify(resData, null, 2));
    }
  } catch (err) {
    console.log("  ⚠ Could not reach commit API:", err.message);
    console.log("    The runtime schema was still updated in the DB directly.");
    console.log("    You may need to manually re-commit or restart the dev server.");
  }

  console.log("\n══════════════════════════════════════════");
  console.log("  Pulse DB fix completed!");
  console.log("  Default user ID:", DEFAULT_USER_ID);
  console.log("══════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("Fix seed failed:", err);
  process.exit(1);
});
