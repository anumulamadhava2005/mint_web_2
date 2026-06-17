"use client";

import React, { useState, useMemo, useCallback } from "react";
import { PipelineEditor } from "@/lib/runtime/components/pipeline-editor";
import type { PipelineStep, PipelineValidation } from "@/lib/runtime/components/pipeline-editor";

interface WorkflowPipelineEditorProps {
  initialSteps?: PipelineStep[];
  onChange?: (steps: PipelineStep[], validation: PipelineValidation) => void;
}

export default function WorkflowPipelineEditor({ initialSteps, onChange }: WorkflowPipelineEditorProps) {
  const [, forceUpdate] = useState(0);
  const editor = useMemo(() => new PipelineEditor({ steps: initialSteps || [] }), [initialSteps]);

  const rerender = useCallback(() => {
    forceUpdate((n) => n + 1);
    onChange?.(editor.getSteps(), editor.validate());
  }, [editor, onChange]);

  const validation = editor.validate();
  const steps = editor.getSteps();

  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newKey, setNewKey] = useState("");

  const handleAdd = () => {
    if (!newLabel.trim() || !newKey.trim()) return;
    editor.addStep({
      id: `ws-${Date.now()}`,
      stepKey: newKey.trim().toLowerCase().replace(/\s+/g, "_"),
      label: newLabel.trim(),
      approverRole: newRole.trim() || undefined,
      active: true,
    });
    setNewLabel("");
    setNewRole("");
    setNewKey("");
    setAdding(false);
    rerender();
  };

  const handleRemove = (id: string) => {
    editor.removeStep(id);
    rerender();
  };

  const handleToggle = (id: string) => {
    editor.toggleStep(id);
    rerender();
  };

  const handleMove = (id: string, dir: "up" | "down") => {
    const step = steps.find((s) => s.id === id);
    if (!step) return;
    editor.moveStep(id, step.position + (dir === "up" ? -1 : 1));
    rerender();
  };

  return (
    <div data-testid="pipeline-editor" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>Approval Pipeline</div>
          <div style={{ fontSize: 13, color: "#6B7280" }}>
            {steps.filter((s) => s.active).length} active step{steps.filter((s) => s.active).length !== 1 ? "s" : ""}
          </div>
        </div>
        <button
          onClick={() => setAdding(true)}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            background: "#3B82F6",
            color: "white",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          + Add Step
        </button>
      </div>

      {/* Validation */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          {validation.errors.map((e, i) => (
            <div key={i} style={{ color: "#EF4444", fontSize: 13, padding: "4px 0" }}>⚠ {e}</div>
          ))}
          {validation.warnings.map((w, i) => (
            <div key={i} style={{ color: "#F59E0B", fontSize: 13, padding: "4px 0" }}>⚡ {w}</div>
          ))}
        </div>
      )}

      {/* Steps list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 14, background: "#F9FAFB", borderRadius: 8 }}>
            No steps — expenses will be auto-approved
          </div>
        )}
        {steps.map((step, idx) => (
          <div
            key={step.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 8,
              border: `1px solid ${step.active ? "#E5E7EB" : "#F3F4F6"}`,
              background: step.active ? "white" : "#FAFAFA",
              opacity: step.active ? 1 : 0.6,
            }}
          >
            {/* Position */}
            <span style={{ fontWeight: 700, color: "#D1D5DB", fontSize: 16, width: 24, textAlign: "center" }}>
              {step.position}
            </span>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: "#111827" }}>{step.label}</div>
              {step.approverRole && (
                <div style={{ fontSize: 12, color: "#6B7280" }}>Role: {step.approverRole}</div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 4 }}>
              <MiniBtn disabled={idx === 0} onClick={() => handleMove(step.id, "up")}>↑</MiniBtn>
              <MiniBtn disabled={idx === steps.length - 1} onClick={() => handleMove(step.id, "down")}>↓</MiniBtn>
              <MiniBtn onClick={() => handleToggle(step.id)}>{step.active ? "⏸" : "▶"}</MiniBtn>
              <MiniBtn onClick={() => handleRemove(step.id)} danger>✕</MiniBtn>
            </div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div style={{ marginTop: 12, padding: 14, borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              placeholder="Step key (e.g. manager)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              style={{ flex: 1, padding: "6px 10px", borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
            />
            <input
              placeholder="Label (e.g. Manager Approval)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              style={{ flex: 1, padding: "6px 10px", borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
            />
            <input
              placeholder="Approver role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              style={{ flex: 1, padding: "6px 10px", borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleAdd} style={{ padding: "6px 14px", borderRadius: 4, border: "none", background: "#10B981", color: "white", fontSize: 13, cursor: "pointer" }}>
              Add
            </button>
            <button onClick={() => setAdding(false)} style={{ padding: "6px 14px", borderRadius: 4, border: "1px solid #D1D5DB", background: "white", fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniBtn({ disabled, onClick, children, danger }: { disabled?: boolean; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 4,
        border: "1px solid #E5E7EB",
        background: danger ? "#FEF2F2" : "white",
        color: disabled ? "#D1D5DB" : danger ? "#EF4444" : "#374151",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}
