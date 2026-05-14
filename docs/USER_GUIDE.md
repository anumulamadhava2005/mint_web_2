# Mint Web: The Ultimate Developer Guide

Welcome to **Mint Web**, the high-performance design-to-code platform that transforms your visual designs into production-ready full-stack applications. This guide will walk you through every feature and procedure, from your first project to a live, syncing application.

---

## 1. Core Features Overview

*   **Visual Canvas**: A powerful design editor to build your UI.
*   **Mint Runtime**: A lightweight, high-performance engine that handles state, actions, and data bindings.
*   **Automated Backend**: Instant database creation and CRUD API generation.
*   **Workflows (Flows)**: Design complex logic visually using a node-based flowchart editor.
*   **Live Sync**: Reflect canvas changes in your running app instantly without rebuilding.
*   **Multi-Framework Export**: Export to React, Next.js, Vue, Svelte, and more.

---

## 2. Getting Started: The Design Phase

### Creating a New Project
1.  Navigate to the **Dashboard**.
2.  Click **"New Project"**.
3.  Choose a template or start from a **Blank Canvas**.
4.  Enter your project name and select your target framework (e.g., Next.js).

### Working with Frames (Screens)
*   **Adding a Frame**: Use the Frame tool (F) to draw a new screen on the canvas. Each frame represents a route in your application (e.g., `Home`, `Login`, `Dashboard`).
*   **Nesting**: You can nest frames within frames to create complex layouts or reusable components.

### Design Properties & Styling
Select any element to modify its properties in the **Right Sidebar**:
*   **Layout**: Configure Flexbox or Grid settings (Direction, Align, Justify, Gap).
*   **Sizing**: Set fixed widths/heights or use percentage-based responsive sizing.
*   **Spacing**: Adjust Padding and Margin.
*   **Visuals**: Apply Backgrounds (Solid/Gradients), Borders (Radius, Width), and Effects (Shadows, Blur).
*   **Typography**: Fully customize fonts, weights, sizes, and colors.

---

## 3. Data & Logic (Mint Runtime)

The "Brain" of your app is the Mint Runtime. It connects your UI to data.

### State Management
State variables hold the data for your app (e.g., `currentUser`, `todos`, `isLoading`).
*   **Global State**: Accessible from any screen.
*   **Local State**: Scoped to a specific frame.
*   **Persistence**: Enable "Persist" to save state to `localStorage` automatically.

### Data Bindings
Bind UI properties to state variables or expressions:
1.  Select a component (e.g., a Text element).
2.  In the **Bindings** panel, click the link icon next to a property (e.g., "Content").
3.  Enter an expression like `$global.userName` or `$local.itemCount > 0 ? 'Visible' : 'Hidden'`.

### Actions Management
Actions are functions triggered by events like `onPress` or `onMount`.

#### How to write Action Configs (In Detail)
Actions use a JSON-based configuration. Here are the most common types:

**1. `setState` (Update Data)**
Updates a specific path in your state.
```json
{
  "path": "todos",
  "value": "$args.0", // Takes the first argument passed to the action
  "also": "SET $lastUpdated = now()" 
}
```

**2. `fetch` (API & Database)**
Perform HTTP requests or database queries.
```json
{
  "url": "/api/todos",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "body": { "title": "$args.0", "status": "pending" },
  "storePath": "todos", // Automatically saves result to this state path
  "onSuccess": "CALL loadTodos; TOAST 'Success!'"
}
```

**3. `navigate` (Change Screens)**
```json
{
  "route": "/dashboard",
  "params": { "userId": "$global.user.id" }
}
```

**4. `condition` (Logic)**
```json
{
  "expression": "$global.isLoggedIn",
  "then": ["CALL goToDashboard"],
  "else": ["OPEN_MODAL 'LoginModal'"]
}
```

---

## 4. Creating Flows (Workflows)

Workflows allow you to design logic as a flowchart instead of writing complex action strings.

1.  Open the **Workflows Tab**.
2.  Click **"Add Workflow"**.
3.  **Nodes**: Add nodes for Logic (`Condition`, `Loop`, `Delay`), Backend (`API Call`, `DB Query`), or UI (`Navigate`, `Show Modal`).
4.  **Edges**: Connect nodes with arrows to define the execution path.
5.  **Conditions on Edges**: You can click an arrow and add a condition (e.g., `{{$_node_1_output.success}}`) to create branching logic.

---

## 5. Database & Backend

### Database Configuration
Mint Web automatically provisions a PostgreSQL database for your project.
1.  Go to the **Database Tab**.
2.  Click **"Enable Database"**.

### Table Creation
1.  Click **"New Table"**.
2.  **Fields**: Define your columns (e.g., `id` (UUID), `title` (Text), `completed` (Boolean)).
3.  **Relations**: Set up `one-to-many` or `many-to-many` links between tables.
4.  **Policies**: Configure Row Level Security (RLS) to control who can read/write data (e.g., `auth.uid() = user_id`).

---

## 6. Export, Convert & Sync

### How to Convert
Once your design is ready, click the **"Export"** button in the top header.
*   Mint Web will "flatten" your design tree into optimized code.
*   It generates the `MintProvider`, your components, and the backend routes.

### How to Extract
After conversion, you can:
1.  **Download ZIP**: Get the full source code for your framework.
2.  **Push to GitHub**: Connect your repo and push changes directly.
3.  **CLI**: Use `npx mint-cli pull` to extract code into an existing project.

### Reflecting Canvas Changes (Live Sync)
This is the "magic" feature. To update your app without a rebuild:
1.  Make a change on the canvas (e.g., change a button color).
2.  Click **"Commit Changes"** in the editor.
3.  If your running app has the **Sync Daemon** enabled, it will detect the new version (via the `/api/sync` endpoint) and update the UI instantly.

---

## 7. Pro Tips for Newbies
*   **Use Expressions**: Use `$` to access state (e.g., `$user.name`).
*   **Prefix Tables**: If you are writing raw SQL, the runtime handles namespacing automatically—just use your table name as defined.
*   **Check the Console**: The Mint Runtime logs every action and state change in the browser console for easy debugging.

---
*Happy Building! If you get stuck, click the "?" icon in the editor to chat with our support team.*
