# 💬 Build a Real-Time Chat App in Mint

A step-by-step guide to building a fully functional chat application using the Mint design-to-code platform — from visual design to a deployed app with a live database.

**What you'll build:**
- A login screen with username entry
- A chat room with scrollable message history
- A message input bar with a send button
- A database-backed message store (PostgreSQL)
- Live-loading messages on screen mount

**Estimated time:** 20–30 minutes

---

## Table of Contents

1. [Create the Project](#1-create-the-project)
2. [Design the Login Screen](#2-design-the-login-screen)
3. [Design the Chat Screen](#3-design-the-chat-screen)
4. [Set Up the Database](#4-set-up-the-database)
5. [Define State Variables](#5-define-state-variables)
6. [Create Actions](#6-create-actions)
7. [Wire Up Bindings](#7-wire-up-bindings)
8. [Add Navigation Between Screens](#8-add-navigation-between-screens)
9. [Export & Run](#9-export--run)
10. [Next Steps](#10-next-steps)

---

## 1. Create the Project

1. Go to your **Dashboard** (the `/projects` page).
2. Click **"New Project"**.
3. Name it `ChatApp` (or any name you like).
4. A new file named `Untitled` will be created — double-click the file name in the header to rename it to `Chat`.
5. You'll land on a blank canvas.

> **Tip:** The file name you set here becomes the export filename when you convert to code.

---

## 2. Design the Login Screen

This is the first screen users see. They'll enter a username and tap "Join Chat."

### Step 2.1 — Draw the Frame

1. Press **`F`** on your keyboard to activate the Frame tool.
2. Draw a frame on the canvas — approximately **375 × 812 px** (mobile) or **1440 × 900 px** (desktop).
3. In the **Layers** panel (left sidebar), rename the frame to `Login`.

> **Important:** Frame names become URL routes. `Login` → `/login`. The **first frame** on your canvas is always the home route (`/`).

### Step 2.2 — Add the UI Elements

Use the toolbar tools to add elements inside the `Login` frame:

| Tool | Shortcut | Element | Purpose |
|------|----------|---------|---------|
| Rectangle | `R` | Background card | A centered card container |
| Text | `T` | Title | "Welcome to Chat" heading |
| Text | `T` | Subtitle | "Enter your username to join" |
| Rectangle | `R` | Input field | Styled as a text input |
| Rectangle | `R` | Button | "Join Chat" button |

### Step 2.3 — Style the Elements

Select each element and use the **Right Panel → Design** tab:

**Background card:**
- Fill: `#1A1A2E` (dark blue)
- Corner radius: `16`
- Width: `360`, Height: `320`
- Center it in the frame

**Title text:**
- Content: `Welcome to Chat`
- Font: Inter, 24px, Bold
- Color: `#FFFFFF`

**Subtitle text:**
- Content: `Enter your username to join`
- Font: Inter, 14px, Regular
- Color: `#A8A6A2`

**Input field:**
- Fill: `#16213E`
- Corner radius: `8`
- Width: `300`, Height: `44`
- Add a text child inside: "Username..." (placeholder style)
- Stroke: 1px, color `#333366`

**Join Chat button:**
- Fill: `#6366F1` (indigo)
- Corner radius: `8`
- Width: `300`, Height: `44`
- Add a text child: "Join Chat", color `#FFFFFF`, 14px, Semibold

---

## 3. Design the Chat Screen

### Step 3.1 — Draw the Chat Frame

1. Press **`F`** and draw a new frame next to the Login frame.
2. Same dimensions as Login.
3. Rename it to `ChatRoom` in the Layers panel.

### Step 3.2 — Build the Layout

The chat screen has **3 vertical sections**: header, message area, and input bar.

#### Header Bar
- Draw a **rectangle** at the top: full width × 56px height.
- Fill: `#1A1A2E`
- Add text: `"Chat Room"`, 16px, Semibold, White.
- Add another text for the username display: `"@username"`, 12px, color `#A8A6A2`.

#### Message Area (scrollable)
- Draw a **frame** below the header: full width, fill remaining height.
- Fill: `#0F0F23` (very dark)
- This frame will hold the message list.

Inside this frame, create a **single message bubble** that will be repeated for each message:

**Message Bubble (template):**
- Draw a **frame** — width: `280`, height: auto (flexible).
- Name it `MessageBubble` in the Layers panel.
- Fill: `#1E1E3F`
- Corner radius: `12`
- Padding: `12`

Inside the bubble, add:
- **Text** — for the sender name: `"User"`, 11px, Bold, color `#8B8BFF`
- **Text** — for the message body: `"Hello, world!"`, 14px, Regular, color `#F6F4F0`
- **Text** — for the timestamp: `"12:34 PM"`, 10px, color `#666360`

#### Input Bar
- Draw a **rectangle** at the bottom: full width × 64px height.
- Fill: `#1A1A2E`
- Inside it:
  - **Input rectangle**: flex-1, height `40`, fill `#16213E`, corner radius `20`, stroke `#333366`
  - **Send button**: `44 × 40`, fill `#6366F1`, corner radius `20`
  - Add a text "Send" or a ▶ icon inside the button.

---

## 4. Set Up the Database

Now let's create the database table that stores chat messages.

### Step 4.1 — Open the Backend Tab

1. In the **Right Panel**, switch to the **Backend** tab (the last tab — it shows ⚡).
2. Click the **DB** sub-tab.

### Step 4.2 — Create the Messages Table

1. In the **table name** input, type `messages`.
2. Click the **+** button to create the table.
3. The table appears — click the **▶** arrow to expand it.

### Step 4.3 — Add Fields

Click **"+ Add"** for each field:

| Field Name | Type | Required | Unique |
|-----------|------|----------|--------|
| `sender` | text | ✅ | ❌ |
| `content` | text | ✅ | ❌ |
| `sent_at` | datetime | ❌ | ❌ |

> Leave **Timestamps** checked — this auto-adds `created_at` and `updated_at` columns.

### Step 4.4 — Save & Deploy

1. Click **Save** to persist the schema.
2. Click **Deploy** to provision the actual PostgreSQL table.

---

## 5. Define State Variables

Switch to the **State** sub-tab in the Backend panel.

Add these global state variables by entering each name, selecting the type, and setting the default value:

| Variable Name | Type | Default Value |
|--------------|------|---------------|
| `username` | string | `""` |
| `messages` | array | `[]` |
| `newMessage` | string | `""` |
| `isLoggedIn` | boolean | `false` |

**How to add each one:**
1. Type the variable name in the input field.
2. Select the type from the dropdown.
3. Type the default value.
4. Click **"+ Add"**.

---

## 6. Create Actions

Switch to the **Actions** sub-tab. Create the following actions:

### Action 1: `joinChat`

**Purpose:** Set the username and navigate to the chat screen.

1. Name: `joinChat`
2. Type: `setState`
3. Click the ▶ to expand → click **"Apply Config"** with this JSON:

```json
{
  "path": "isLoggedIn",
  "value": true,
  "also": "SET $currentScreen = ChatRoom"
}
```

### Action 2: `loadMessages`

**Purpose:** Fetch all messages from the database on screen load.

1. Name: `loadMessages`
2. Type: `fetch`
3. Config:

```json
{
  "body": {
    "sql": "SELECT * FROM \"messages\" ORDER BY \"created_at\" DESC LIMIT 50",
    "params": []
  },
  "onSuccess": "SET $messages = result.rows"
}
```

> **Note:** Because the action name starts with `load`, the Mint Runtime automatically calls it on mount (using a `useEffect`).

### Action 3: `sendMessage`

**Purpose:** Insert a new message into the database and refresh the list.

1. Name: `sendMessage`
2. Type: `fetch`
3. Config:

```json
{
  "body": {
    "sql": "INSERT INTO \"messages\" (\"sender\", \"content\", \"sent_at\") VALUES ($1, $2, NOW())",
    "params": ["$username", "$newMessage"]
  },
  "onSuccess": "SET $newMessage = ''; CALL loadMessages"
}
```

### Action 4: `updateNewMessage`

**Purpose:** Update the `newMessage` state as the user types.

1. Name: `updateNewMessage`
2. Type: `setState`
3. Config:

```json
{
  "path": "newMessage",
  "value": "$args.0"
}
```

**Don't forget to Save** — click the **Save** button at the top of the Backend panel.

---

## 7. Wire Up Bindings

Now connect the UI elements to the backend data using the **Bindings** section.

### Login Screen Bindings

Select each element and set bindings in the **⚡ Bindings** section of the Design panel:

| Element | Binding Field | Value |
|---------|--------------|-------|
| Username input text | **Input Bind (2-way)** | `$username` |
| "Join Chat" button | **On Click (action)** | `joinChat` |

> **Tip:** The binding fields now show autocomplete suggestions! When you click on "On Click", you'll see `joinChat`, `loadMessages`, `sendMessage`, and `updateNewMessage` as suggestions from the actions you just created.

### Chat Screen Bindings

| Element | Binding Field | Value |
|---------|--------------|-------|
| "@username" text | **Text / Content** | `$username` |
| Message Area frame | **Data Source (table)** | `messages` |
| Message Area frame | **Repeat For** | `$messages` |
| Message Area frame | **Repeat As** | `msg` |
| Sender name text | **Text / Content** | `$msg.sender` |
| Message body text | **Text / Content** | `$msg.content` |
| Timestamp text | **Text / Content** | `$msg.sent_at` |
| Message input field | **Input Bind (2-way)** | `$newMessage` |
| Send button | **On Click (action)** | `sendMessage` |

### Visibility Binding

Optionally, you can control screen visibility:

| Element | Binding Field | Value |
|---------|--------------|-------|
| Chat Room frame | **Visible When** | `$isLoggedIn` |

---

## 8. Add Navigation Between Screens

### Using Prototype Interactions

1. Select the **"Join Chat" button** on the Login screen.
2. Switch to the **Prototype** tab in the Right Panel.
3. Add an interaction:
   - **Trigger:** `On Click`
   - **Action:** `Navigate`
   - **Destination:** Select the `ChatRoom` frame

This creates a clickable navigation link that the export engine picks up.

### Using Action-Based Navigation

Alternatively, the `joinChat` action already handles navigation via `SET $currentScreen = ChatRoom`. The Mint Runtime resolves this to `window.location.href = "/chatroom"` in the generated code.

---

## 9. Export & Run

### Step 9.1 — Export to Code

1. Click the **"Convert"** button in the top header bar.
2. Mint will analyze your design and recommend a framework. Choose one:
   - **React** — Vite + TypeScript + Tailwind
   - **Next.js** — App Router + SSR
   - **Vue / Svelte** — equivalent setups
   - **React Native** — Expo for mobile
3. Click **"Export ZIP"**.
4. A ZIP file downloads containing your full project.

### Step 9.2 — Run Locally

Unzip the download and run:

```bash
# For React / Next.js / Vue / Svelte:
cd chatapp-react        # (or your chosen framework folder)
npm install
npm run dev

# For React Native:
cd chatapp-react-native
npm install
npx expo start
```

### Step 9.3 — What's Inside the ZIP

```
chatapp-react/
├── src/
│   ├── MintRuntime.tsx          ← Auto-generated state + actions provider
│   ├── components/
│   │   ├── Login.tsx            ← Login screen component
│   │   └── ChatRoom.tsx         ← Chat screen component
│   ├── App.tsx                  ← Root with MintProvider + routing
│   └── index.css                ← Extracted styles
├── package.json
├── tsconfig.json
└── vite.config.ts
```

The `MintRuntime.tsx` file contains:
- All your state variables with their defaults
- All actions (`joinChat`, `loadMessages`, `sendMessage`, `updateNewMessage`)
- The `dbQuery()` helper that connects to the Mint database bridge
- The `MintProvider` wrapper and `useMint()` hook

### Step 9.4 — Use Live Sync (Optional)

Instead of re-exporting every time you make a design change:

1. Make changes on the canvas (adjust colors, layout, text).
2. Click **"Commit"** in the header (choose your target framework).
3. Your running app detects the new version via the Sync Daemon and hot-patches the UI automatically — no page reload needed.

---

## 10. Next Steps

Once your basic chat app is working, here are some enhancements you can build:

### Add a Typing Indicator
1. Add a `isTyping` boolean state variable.
2. Create a `setTyping` action that sets `$isTyping = true` with a 2-second `delay` action to reset it.
3. Bind a "..." text bubble's `Visible When` to `$isTyping`.

### Add Timestamps Formatting
1. The `sent_at` field comes as a raw ISO string. In your exported code, you can modify the component to use `new Date(msg.sent_at).toLocaleTimeString()`.

### Add Rooms / Channels
1. Add a `rooms` table with fields: `name` (text), `description` (text).
2. Add a `room_id` field to the `messages` table.
3. Create a `loadRooms` action and add a room selector screen.
4. Filter messages by room: `SELECT * FROM "messages" WHERE "room_id" = $1`.

### Add User Avatars
1. Add a `color` text field to represent each user's avatar color.
2. Draw a colored circle in the message bubble.
3. Bind the fill color to `$msg.color`.

### Add Message Reactions
1. Create an `reactions` table: `message_id` (text), `emoji` (text), `user` (text).
2. Add a `reactToMessage` action that inserts into the reactions table.
3. Add emoji buttons below each message bubble.

---

## Quick Reference: Key Concepts Used

| Concept | Where Used | How |
|---------|-----------|-----|
| **Frames** | Login, ChatRoom | Each frame = one route |
| **State** | `username`, `messages`, etc. | Global state via Backend → State tab |
| **Actions** | `sendMessage`, `loadMessages` | Backend → Actions tab with JSON config |
| **Bindings** | Input Bind, Text Content, On Click | Design panel → ⚡ Bindings section |
| **Database** | `messages` table | Backend → DB tab → Add table + fields |
| **Datalist** | Bindings autocomplete | Options auto-populated from Backend tab |
| **Repeat For** | Message list | Frame repeats for each item in `$messages` |
| **Navigation** | Login → ChatRoom | Prototype tab interactions or action-based |
| **Export** | ZIP download | Convert button → choose framework |
| **Live Sync** | Hot-patch UI | Commit button → Sync Daemon |

---

## Troubleshooting

### Messages not loading?
- Make sure the `loadMessages` action has `body.sql` with the correct SQL query.
- Check that you clicked **Deploy** in the Database tab after creating the table.
- Open the browser console — the Mint Runtime logs every action execution.

### Navigation not working?
- Verify that the Login frame is the **first frame** on the canvas (it becomes `/`).
- Check that the Prototype interaction destination points to `ChatRoom`.
- If using action-based navigation, ensure `SET $currentScreen = ChatRoom` maps correctly.

### Bindings not showing suggestions?
- Make sure you've added state variables and actions in the **Backend tab** first.
- The bindings panel reads from the runtime store — if you see "0 vars · 0 actions", the schema hasn't been saved yet.
- Click **Save** in the Backend panel, then re-select the shape.

---

*Happy building! 🚀 If you get stuck, check the browser DevTools console — the Mint Runtime logs every state change and action call in real time.*
