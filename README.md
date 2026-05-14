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



## Development workflow (how to download, set up, and run in development mode)

1. Clone the repository locally:

```powershell
git clone https://github.com/seawind101/YtechAuto.git
cd YtechAuto
```

2. Install dependencies:

```powershell
npm install
```

3. Create a `.env` in the project root. At minimum set `PORT` and `ADMIN`:

```
PORT=3000
ADMIN=admin@example.com
```

4. Initialize the database (creates SQLite file and tables):

```powershell
node scripts/initDatabase.js
```

5. Run in development mode (auto-restart on changes):

```powershell
npm install -g nodemon
nodemon app
```

6. Open the app in your browser at `http://localhost:3000`.

Notes:
- Use the browser DevTools console to inspect client-side logs produced by `public/js/form.js`.
- Edit files in `routes/`, `views/`, or `public/js/` then save — `nodemon` will restart the server automatically.

## Production deployment (recommended steps)

These are general deployment recommendations. Adjust for your host (IIS, Windows Server, Linux, Docker, Heroku, etc.).

1. Prepare production environment variables (do not commit `.env`):

```
NODE_ENV=production
PORT=3000
ADMIN=admin@example.com
```

2. Ensure the production machine has Node.js installed. Optional: build static assets if you add any build step.

3. Initialize or migrate the database on the production host:

```bash
node scripts/initDatabase.js
# or run any migration scripts you maintain
```

4. Use a process manager to run the app (keeps it running and restarts on crash). Example with `pm2` (Linux/Windows supported):

```bash
npm install -g pm2
pm2 start app.js --name ytechauto
pm2 save
pm2 startup
```

5. Put the app behind a reverse proxy / TLS terminator (recommended):
- Linux: use Nginx to forward HTTPS to your Node app's port.
- Windows: use IIS ARR or an external reverse proxy. Alternatively, host in Docker and use Traefik.

6. Secure file and DB permissions and protect your `.env` file (do not share credentials publicly).

7. Monitor logs (pm2 logs or a centralized log service) and set up backups for the SQLite DB file.

## GitHub repo workflow (recommended)

Use a branch-based workflow with code review via pull requests (PRs):

- `main` protected: keep `main` as the production-ready branch. Enable branch protection and require PR reviews before merging.
- Feature branches: create short-lived branches named `feature/xxx` or `fix/xxx` from `main`.
- Pull Requests: open a PR targeting `main` with a clear description and link to issues if applicable. Request at least one reviewer.
- Code style & linting: run linters and tests locally before pushing. Consider adding GitHub Actions to run `npm test` and linting on push/PR.
- Merge: use squash-merge or merge commits per your preference; protect `main` so only PRs can be merged.

Example basic Git flow (PowerShell):

```powershell
# update main
git checkout main
git pull origin main

# create feature
git checkout -b feature/my-change
# make changes, commit
git add .
git commit -m "Add mechanic repairs validation improvements"
git push origin feature/my-change
# open PR on GitHub web UI
```

CI/CD suggestions:
- Add a GitHub Actions workflow to run Node tests and lint on PRs.
- Optionally, add a deployment action that runs on merge to `main` to deploy to your server (SSH/rsync, Docker push, or a cloud provider API).