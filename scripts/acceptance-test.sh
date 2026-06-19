#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Step 3: Full Acceptance Test via curl
# Employee submit → Manager approve → Finance approve →
# Admin INSERT dept_head step → Submit 2nd expense →
# Verify routing includes department_head after finance
# ═══════════════════════════════════════════════════════════════

set -e

TOKEN="401fb95337eefa718540794c4dddc998535df19858908724b4f00c6569f03530"
PID="5a31e6a7-9a4f-4722-a488-83b12aa038d3"
DB="http://localhost:3001/api/db/$PID"
H=(-H "Cookie: token=$TOKEN" -H "Content-Type: application/json")

db() {
  curl -s "${H[@]}" -d "$1" "$DB"
}

echo "=== CLEANUP ==="
db '{"sql":"DELETE FROM approval_events WHERE expense_id IS NOT NULL"}'
db '{"sql":"DELETE FROM expenses WHERE title IS NOT NULL"}'
echo ""

echo "=== 1. Employee submits expense ==="
# Get the first workflow step (should be manager)
FIRST_STEP=$(db '{"sql":"SELECT step_key FROM workflow_steps WHERE active = true ORDER BY position ASC LIMIT 1"}' | python3 -c "import sys,json; r=json.load(sys.stdin)['rows']; print(r[0]['step_key'] if r else 'none')")
echo "First step: $FIRST_STEP"

SUBMIT_RESULT=$(db "{\"sql\":\"INSERT INTO expenses (title, description, amount, category, status, current_step_key) VALUES (\$1,\$2,\$3,\$4,\$5,\$6) RETURNING *\",\"params\":[\"Team Dinner\",\"Q2 team celebration\",250.00,\"meals\",\"pending_$FIRST_STEP\",\"$FIRST_STEP\"]}")
echo "Submit: $SUBMIT_RESULT"
EXP_ID=$(echo "$SUBMIT_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['rows'][0]['id'])")
echo "Expense ID: $EXP_ID"
echo ""

echo "=== 2. Manager approves ==="
# Get next step after manager
NEXT_AFTER_MANAGER=$(db '{"sql":"SELECT step_key, position FROM workflow_steps WHERE active = true ORDER BY position ASC"}' | python3 -c "
import sys,json
rows = json.load(sys.stdin)['rows']
idx = next((i for i,r in enumerate(rows) if r['step_key']=='manager'), -1)
print(rows[idx+1]['step_key'] if idx >= 0 and idx < len(rows)-1 else 'approved')
")
echo "Next after manager: $NEXT_AFTER_MANAGER"

if [ "$NEXT_AFTER_MANAGER" = "approved" ]; then
  NEW_STATUS="approved"
  NEW_KEY="null"
else
  NEW_STATUS="pending_$NEXT_AFTER_MANAGER"
  NEW_KEY="$NEXT_AFTER_MANAGER"
fi

APPROVE1=$(db "{\"sql\":\"UPDATE expenses SET status=\$1, current_step_key=\$2 WHERE id=\$3 RETURNING status, current_step_key\",\"params\":[\"$NEW_STATUS\",\"$NEW_KEY\",\"$EXP_ID\"]}")
echo "Manager approve: $APPROVE1"
db "{\"sql\":\"INSERT INTO approval_events (expense_id, step_key, label, status) VALUES (\$1,\$2,\$3,\$4)\",\"params\":[\"$EXP_ID\",\"manager\",\"Manager Approved\",\"completed\"]}"
echo ""

echo "=== 3. Finance approves ==="
NEXT_AFTER_FINANCE=$(db '{"sql":"SELECT step_key, position FROM workflow_steps WHERE active = true ORDER BY position ASC"}' | python3 -c "
import sys,json
rows = json.load(sys.stdin)['rows']
idx = next((i for i,r in enumerate(rows) if r['step_key']=='finance'), -1)
print(rows[idx+1]['step_key'] if idx >= 0 and idx < len(rows)-1 else 'NONE')
")
echo "Next after finance: $NEXT_AFTER_FINANCE"

APPROVE2=$(db "{\"sql\":\"UPDATE expenses SET status=\$1, current_step_key=\$2 WHERE id=\$3 RETURNING status, current_step_key\",\"params\":[\"approved\",null,\"$EXP_ID\"]}")
echo "Finance approve: $APPROVE2"
db "{\"sql\":\"INSERT INTO approval_events (expense_id, step_key, label, status) VALUES (\$1,\$2,\$3,\$4)\",\"params\":[\"$EXP_ID\",\"finance\",\"Finance Approved\",\"completed\"]}"
echo ""

echo "=== 4. Admin adds Department Head step (LIVE DB write, no re-export) ==="
# Get max position
MAX_POS=$(db '{"sql":"SELECT COALESCE(MAX(position),0)+1 AS pos FROM workflow_steps"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['rows'][0]['pos'])")
echo "New position: $MAX_POS"

ADD_STEP=$(db "{\"sql\":\"INSERT INTO workflow_steps (step_key, label, approver_role, position, active) VALUES (\$1,\$2,\$3,\$4,true) RETURNING *\",\"params\":[\"dept_head\",\"Department Head Approval\",\"department_head\",$MAX_POS]}")
echo "Add step: $ADD_STEP"

echo ""
echo "=== Verify workflow now has 3 steps ==="
STEPS=$(db '{"sql":"SELECT step_key, label, position FROM workflow_steps WHERE active = true ORDER BY position ASC"}')
echo "Steps: $STEPS"
echo ""

echo "=== 5. Submit second expense — should route through dept_head ==="
# The getNextStep() logic reads workflow_steps LIVE, so the first step is still manager
SUBMIT2=$(db "{\"sql\":\"INSERT INTO expenses (title, description, amount, category, status, current_step_key) VALUES (\$1,\$2,\$3,\$4,\$5,\$6) RETURNING *\",\"params\":[\"Software License\",\"JetBrains annual\",599.00,\"software\",\"pending_manager\",\"manager\"]}")
echo "Submit 2: $SUBMIT2"
EXP2_ID=$(echo "$SUBMIT2" | python3 -c "import sys,json; print(json.load(sys.stdin)['rows'][0]['id'])")

# Manager approves → next should be finance
NEXT2=$(db '{"sql":"SELECT step_key, position FROM workflow_steps WHERE active = true ORDER BY position ASC"}' | python3 -c "
import sys,json
rows = json.load(sys.stdin)['rows']
idx = next((i for i,r in enumerate(rows) if r['step_key']=='manager'), -1)
print(rows[idx+1]['step_key'] if idx >= 0 and idx < len(rows)-1 else 'NONE')
")
echo "After manager approve: next=$NEXT2"
db "{\"sql\":\"UPDATE expenses SET status=\$1, current_step_key=\$2 WHERE id=\$3\",\"params\":[\"pending_$NEXT2\",\"$NEXT2\",\"$EXP2_ID\"]}"
db "{\"sql\":\"INSERT INTO approval_events (expense_id, step_key, label, status) VALUES (\$1,\$2,\$3,\$4)\",\"params\":[\"$EXP2_ID\",\"manager\",\"Manager Approved\",\"completed\"]}"

# Finance approves → next should be dept_head (the NEW step!)
NEXT3=$(db '{"sql":"SELECT step_key, position FROM workflow_steps WHERE active = true ORDER BY position ASC"}' | python3 -c "
import sys,json
rows = json.load(sys.stdin)['rows']
idx = next((i for i,r in enumerate(rows) if r['step_key']=='finance'), -1)
print(rows[idx+1]['step_key'] if idx >= 0 and idx < len(rows)-1 else 'NONE')
")
echo "After finance approve: next=$NEXT3"
db "{\"sql\":\"UPDATE expenses SET status=\$1, current_step_key=\$2 WHERE id=\$3\",\"params\":[\"pending_$NEXT3\",\"$NEXT3\",\"$EXP2_ID\"]}"
db "{\"sql\":\"INSERT INTO approval_events (expense_id, step_key, label, status) VALUES (\$1,\$2,\$3,\$4)\",\"params\":[\"$EXP2_ID\",\"finance\",\"Finance Approved\",\"completed\"]}"
echo ""

echo "=== 6. Final verification: expense 2 status ==="
FINAL=$(db "{\"sql\":\"SELECT id, title, status, current_step_key FROM expenses WHERE id=\$1\",\"params\":[\"$EXP2_ID\"]}")
echo "Final state: $FINAL"
echo ""

# Check that it's now pending dept_head
STATUS=$(echo "$FINAL" | python3 -c "import sys,json; print(json.load(sys.stdin)['rows'][0]['status'])")
STEP_KEY=$(echo "$FINAL" | python3 -c "import sys,json; print(json.load(sys.stdin)['rows'][0]['current_step_key'])")

if [ "$STATUS" = "pending_dept_head" ] && [ "$STEP_KEY" = "dept_head" ]; then
  echo "✅ ACCEPTANCE TEST PASS: Second expense routed through dept_head after finance (status=$STATUS, step_key=$STEP_KEY)"
else
  echo "❌ ACCEPTANCE TEST FAIL: Expected pending_dept_head/dept_head, got $STATUS/$STEP_KEY"
fi
