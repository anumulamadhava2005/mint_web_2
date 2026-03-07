// Cursor Overlay Component - Shows other users' cursors in real-time
"use client";

import React from "react";
import { Participant } from "@/hooks/useCollaboration";

interface CursorOverlayProps {
  participants: Map<string, Participant>;
  currentUserId: string | null;
  viewport: { x: number; y: number; zoom: number };
}

export function CursorOverlay({ participants, currentUserId, viewport }: CursorOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from(participants.values())
        .filter(p => p.id !== currentUserId)
        .map(participant => (
          <Cursor
            key={participant.id}
            participant={participant}
            viewport={viewport}
          />
        ))}
    </div>
  );
}

interface CursorProps {
  participant: Participant;
  viewport: { x: number; y: number; zoom: number };
}

function Cursor({ participant, viewport }: CursorProps) {
  const { cursor, email, color } = participant;

  // Transform world coordinates to screen coordinates
  const screenX = (cursor.x - viewport.x) * viewport.zoom;
  const screenY = (cursor.y - viewport.y) * viewport.zoom;

  return (
    <div
      className="absolute transition-transform duration-100 ease-out"
      style={{
        transform: `translate(${screenX}px, ${screenY}px)`,
      }}
    >
      {/* Cursor SVG */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}
      >
        <path
          d="M5.65376 12.3673L11.6731 10.3912L9.69683 16.4106L11.8917 19.3008L15.3701 13.3677L22.6783 11.3644L5.65376 12.3673Z"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Name tag */}
      <div
        className="absolute top-6 left-2 px-2 py-1 rounded text-xs text-white font-medium whitespace-nowrap"
        style={{
          backgroundColor: color,
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        {email.split("@")[0]}
      </div>

      {/* Selection indicator (if any) */}
      {participant.selection && participant.selection.length > 0 && (
        <div
          className="absolute top-6 left-2 w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: color }}
        />
      )}
    </div>
  );
}

// Selection Highlight Component - Shows what other users have selected
interface SelectionHighlightProps {
  shapeId: string;
  participants: Map<string, Participant>;
  shapeBounds: { x: number; y: number; width: number; height: number };
}

export function SelectionHighlight({ shapeId, participants, shapeBounds }: SelectionHighlightProps) {
  const selectingUsers = Array.from(participants.values()).filter(
    p => p.selection?.includes(shapeId)
  );

  if (selectingUsers.length === 0) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: shapeBounds.x,
        top: shapeBounds.y,
        width: shapeBounds.width,
        height: shapeBounds.height,
      }}
    >
      {selectingUsers.map(user => (
        <div
          key={user.id}
          className="absolute inset-0 border-2 rounded"
          style={{
            borderColor: user.color,
            boxShadow: `0 0 0 1px ${user.color}33`,
          }}
        />
      ))}
    </div>
  );
}

// Participants List Component - Shows active users
interface ParticipantsListProps {
  participants: Map<string, Participant>;
  currentUserId: string | null;
  latency: number;
}

export function ParticipantsList({ participants, currentUserId, latency }: ParticipantsListProps) {
  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 min-w-[200px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b">
        <h3 className="text-sm font-semibold text-gray-800">
          Active Users ({participants.size})
        </h3>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${latency < 100 ? "bg-green-500" : latency < 200 ? "bg-yellow-500" : "bg-red-500"}`} />
          <span className="text-xs text-gray-600">{latency}ms</span>
        </div>
      </div>

      {/* Participants */}
      <div className="space-y-2">
        {Array.from(participants.values()).map(participant => (
          <div key={participant.id} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: participant.color }}
            />
            <span className="text-sm text-gray-700 truncate">
              {participant.email.split("@")[0]}
              {participant.id === currentUserId && " (you)"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
