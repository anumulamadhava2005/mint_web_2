# Mint Web: Actions Configuration Guide

This guide describes how to configure **Actions** in a Mint Web project. Actions represent the behavior and business logic of your application—connecting user events (such as button presses, input changes, and screen mounts) with state modifications, backend API calls, database operations, and screen routing.

The instructions below are derived directly from the Mint Runtime compiler engine (`lib/convert/core/mintRuntime.ts`) which translates action schemas into execution blocks for Web (React/Next.js) and Mobile (React Native/Expo).

---

## 1. Action Schema Structure

In the project configuration, actions are defined as an array under `globalActions` (app-wide) or `actions` (screen-specific). Each action object follows this schema:

```json
{
  "id": "uuid-string",
  "name": "actionFunctionName",
  "type": "setState | fetch | mutate | navigate | custom",
  "config": {
    // Type-specific configurations
  }
}
```

*   **`id`**: Unique identifier for the action.
*   **`name`**: The JavaScript function name exposed by the runtime hook (e.g. `const { actions } = useMint(); actions.actionFunctionName()`).
*   **`type`**: The category of operation to perform.
*   **`config`**: Key-value map defining parameters for the specific action type.

---

## 2. Action Types & Configurations

### 2.1. `fetch` / `mutate`
Handles REST API requests as well as direct PostgreSQL database queries. The runtime distinguishes between them based on the presence of the `url` config property.

#### Option A: REST API Calls
If `url` is specified, the runtime performs an HTTP request.

```json
{
  "id": "fetch-todos",
  "name": "getTodos",
  "type": "fetch",
  "config": {
    "url": "/api/todos/:status",
    "method": "GET",
    "body": null,
    "storePath": "todosList",
    "onSuccess": "SET $loading = false; SET $items = $result.rows",
    "onError": "SET $error = 'Failed to load'"
  }
}
```

*   **`url`**: The target endpoint template. Supports parameter replacement (e.g. `:status` gets replaced by looking up `$status` in state or from action arguments).
*   **`method`**: HTTP request verb (`GET`, `POST`, `PUT`, `DELETE`, etc.). Defaults to `GET`.
*   **`body`**: Optional request payload object. Values are evaluated dynamically (nested keys starting with `$` reference state or argument values).
*   **`storePath`**: Optional path in state (e.g., `todosList`) where the final JSON response will be written automatically.
*   **`onSuccess`**: A list of semicolon-separated statements executed when the fetch succeeds (response status is 2xx).
*   **`onError`**: Semicolon-separated statements executed if the fetch fails (non-2xx response or network error).

#### Option B: Database SQL Queries
If `url` is **not** specified, the action runs an SQL query against the project's PostgreSQL database using the `dbQuery` runtime helper.

```json
{
  "id": "insert-todo-db",
  "name": "createTodoInDb",
  "type": "mutate",
  "config": {
    "sql": "INSERT INTO todos (title, status, user_id) VALUES ($1, $2, $3) RETURNING *",
    "params": [
      "$args.0",
      "pending",
      "$global.user.id"
    ],
    "storePath": "lastCreatedTodo",
    "onSuccess": "SET $status = 'Saved successfully'; CALL getTodos",
    "onError": "SET $status = 'Database error'"
  }
}
```

*   **`sql`**: The raw SQL query string. Table names are automatically prefixed with the project's database namespace at compile/runtime (e.g. `FROM todos` → `FROM mint_proj_projectId_todos`).
*   **`params`**: An array of parameters corresponding to the positional SQL placeholders (`$1`, `$2`, etc.). Can consist of literals or references starting with `$`.
*   **`storePath`**: State path where the query results are stored.
*   **`onSuccess` / `onError`**: Semicolon-separated statements executed depending on the query result.

---

### 2.2. `setState`
Updates specific values inside the application state. Dotted paths are supported for updating properties within nested objects.

```json
{
  "id": "update-username",
  "name": "setUsername",
  "type": "setState",
  "config": {
    "path": "form.username",
    "value": "$args.0",
    "also": "SET $form.dirty = true; CALL validateForm"
  }
}
```

*   **`path`**: The target path in the state to mutate (e.g. `form.username` will perform a nested update on the `form` object).
*   **`value`**: The value to set. Can be a literal (e.g., `true`, `"pending"`) or a string referencing arguments/state.
*   **`also`**: Optional semicolon-separated statements executed immediately after the state mutation is completed.
*   **Navigation Trigger**: If the path matches `/current.?screen/i` (e.g. `"currentScreen"` or `"current.screen"`), the runtime treats the value as a screen name. It will look up the screen, convert it to a route, and trigger navigation (Web: `window.location.href`, Native: `router.push`).

---

### 2.3. `navigate`
Transitions between screens.

```json
{
  "id": "go-to-home",
  "name": "navToHome",
  "type": "navigate",
  "config": {
    "target": "/"
  }
}
```

*   **`target`**: The destination route (e.g. `/` or `/dashboard`). Translates to `router.push(target)` on Expo Router (mobile) or `window.location.href = target` on Web.

---

### 2.4. `custom`
Acts as a pure scripting logic container. It executes sequential actions without having a primary state mutation or fetch command.

```json
{
  "id": "verify-and-reload",
  "name": "verifyAndReload",
  "type": "custom",
  "config": {
    "onSuccess": "CALL checkAuth",
    "also": "SET $clicked = true; CALL refreshApp"
  }
}
```

---

## 3. Parameter & Argument Resolution Rules

The runtime dynamically resolves values prefixed with `$` inside action properties (`body`, `params`, `value`, etc.) at execution time:

1.  **`$args.X`** (where X is a number): Resolves to the `X`-th argument passed when calling the action function.
    *   *Example*: If a text input's `onChangeText` triggers the action, the input string is passed as the first argument, accessible via `$args.0`.
2.  **`$path.to.variable`**: Resolves to a property path in the state (e.g., `$form.username` -> `state.form.username`).
3.  **Argument Fallback**: If a path resolves to `undefined` in the state, the runtime checks if the first argument passed (`args[0]`) is an object, and attempts to resolve the key from that object.
    *   *Example*: If the path is `$id` and the action is called with `actions.myAction({ id: 100 })`, the value resolves to `100`.

---

## 4. Scripting Syntax (`onSuccess`, `onError`, `also`)

The `onSuccess`, `onError`, and `also` fields allow chainable scripting. Expressions are split by semicolons (`;`) and executed in sequence.

### 4.1. The `SET` Statement
Modifies a state variable. Syntax: `SET $path = expression`

*   **Values**:
    *   `""` or `''` → Empty string
    *   `[]` → Empty array
    *   `true` / `false` → Booleans
    *   Numbers (e.g., `42`) → Parsed as numbers
    *   Single/double-quoted strings (e.g. `'active'`, `"Guest"`) → Quoted text
    *   State paths (e.g. `$form.email`) → Current value in state
*   **Special API/DB Results**:
    *   `$result` → The root JSON response of the HTTP fetch or database query.
    *   `$result.rows` → The SQL rows array returned from a database query.
    *   `$result.rows[0]` → The first row object.
    *   `$result.rows[0].id` → A specific property of a returned row.
*   **Inline DB Queries (Supported in `also` expressions)**:
    *   `SET $usersList = dbQuery('SELECT * FROM users WHERE status = $1', [$global.currentStatus])`
    *   Executes an inline SQL query and binds the result to a state variable.

### 4.2. The `CALL` Statement
Executes another action by name. Syntax: `CALL actionName` or `chain call actionName`

*   *Example*: `CALL refreshList`
*   *Note*: Fetch/mutate action calls are automatically resolved via React refs (e.g. calling `refreshListRef.current()`) to ensure the latest state context is preserved during chains.
