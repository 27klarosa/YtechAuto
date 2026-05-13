# YtechAuto

A small Node.js / Express app for managing repair orders and mechanic/customer workflows. This README explains how to set up, run, and develop the site locally, plus where to find the code you will likely edit.

---

**Contents**
- **Requirements**: Node.js, npm, Windows PowerShell (development commands provided for PowerShell)
- **Quick start**: install dependencies, initialize DB, run the app
- **Project layout**: where to find routes, views, static assets and client scripts
- **Development notes**: common changes (login, repairs validation, client JS) and how to test them
- **Safety**: how role assignment and error messages are handled

---

## Requirements
- Node.js (v14+ recommended)
- npm (bundled with Node.js)
- SQLite3 (used by the app; `sqlite3` Node package is included in `package.json`)

## Quick start (Windows PowerShell)
1. Install dependencies

```powershell
cd "c:\Users\Carlos.Ort-Patrick\OneDrive - York County School of Technology\Documents\GitHub\YtechAuto"
npm install
```

2. Initialize the database (scripts/initDatabase.js) — this will create the SQLite DB and tables. If a `.env` is required, create one first (see `Environment` below).

```powershell
node scripts/initDatabase.js
```

3. Run the app

```powershell
node app
```

4. Open the site in a browser: http://localhost:3000 (or the port printed by the server)

If the server fails to start, check the console for errors (missing environment variables or DB path issues are common). The top-level `app.js` boots the Express server.

## Environment
The project reads configuration from environment variables. Create a `.env` file in the project root (if not already present). Important variables:
- `PORT` — port to run the server on (defaults in code if omitted)
- `ADMIN` — comma-separated list of admin email addresses used by the `helpers/admins.js` helper (used to decide role during local signup)

Example `.env` (place in project root):

```
PORT=3000
ADMIN=admin1@example.com,admin2@example.com
```

## Project layout (important files)
- `app.js` — Express app entrypoint and middleware setup
- `routes/` — Express route handlers
	- `routes/login.js` — local signup/login/reset handlers
	- `routes/auth.js` — Microsoft/Azure auth callbacks and handling
	- `routes/mechanic.js` — create/update tickets, save recommended repairs and sections
	- other route files for customer/ticket pages
- `views/` — EJS templates rendered by the server (look here for UI markup)
	- `views/loginPage.ejs`, `views/signup.ejs`, `views/mechanic.ejs`, etc.
- `public/` — static assets served by Express
	- `public/css/styles.css` — global styles
	- `public/js/form.js` — large client-side script for the mechanic ticket UI (validation, uploads, signature, PDF)
- `database/` — SQL schema and any seed data (`database.sql`)
- `scripts/initDatabase.js` — helper to initialize DB
- `helpers/admins.js` — parse `ADMIN` env variable and export `isAdmin(email)`

## Recommended files to edit for common changes
- To change the header/login UI: edit `views/index.ejs` and `public/css/styles.css`.
- To change local signup behavior or role assignment: edit `routes/login.js` and `helpers/admins.js`.
- To change ticket save/repairs logic: edit `routes/mechanic.js` and `public/js/form.js`.

## Repairs validation and error handling
- Client-side validation lives in `public/js/form.js`. It validates recommended-repairs rows before submitting and produces friendly messages like:
	- `Missing Description in Recommended Repairs`
	- `Missing Qty, Part Price, or Labor Hours in Recommended Repairs`
	- `Invalid Part Price in Recommended Repairs`
- Server-side `routes/mechanic.js` also validates repairs and maps database constraint errors to concise, sanitized messages (for example, `MissingLaborHours`) to avoid exposing raw SQLite errors to users.

If you want server responses to return JSON for AJAX consumers instead of the current alert+go-back script, search the route and modify the response branch to detect `Accept: application/json` or `req.xhr` and return `res.status(400).json({ error: '...' })`.

## How to change the client-side validation
1. Open `public/js/form.js` and find the `validateAndSubmit` function (near where `form.addEventListener('submit', validateAndSubmit)` is registered).
2. Modify the repair-table validation block to change field names or messaging. The code already uses non-technical, user-friendly messages.

## How to change server-side mapping of DB errors
1. Open `routes/mechanic.js` and find `saveRecRepairs` (search for `INSERT INTO recRepairs`).
2. There is a mapping that converts `NOT NULL` sqlite errors to friendly codes like `MissingLaborHours`. Adjust the mapping if you prefer a different message (e.g. `Missing Labor Hours in Recommended Repairs`).

## Development tips
- Use the browser DevTools console to see client-side logs from `public/js/form.js` (it logs initialization steps and errors).
- When editing `views/*.ejs`, small syntax mistakes can cause EJS compilation errors — check the server console for stack traces and the line number of the template that failed to render.
- If you change server code, restart the Node process. Consider using `nodemon` during development for automatic reloads:

```powershell
npm install -g nodemon
nodemon app
```

## Testing a repair validation failure locally
1. Open the mechanic form and add a recommended repair row but leave `Labor Hours` blank (or other required field).
2. Submit — you should see a friendly alert message (client-side) or a sanitized server message such as `MissingLaborHours` instead of a raw SQLite error.

## Useful commands
- Install deps: `npm install`
- Init DB: `node scripts/initDatabase.js`
- Run server: `node app` (or `nodemon app` during development)

---



