# Stage 1 — Install everything on Windows 10 (beginner friendly)

**What we are building:** a website that runs on your own computer first. You need four free programs.

## 1. Install the software

| Program | Why | Download | During install |
|---|---|---|---|
| **Node.js 22 LTS** | runs the app | https://nodejs.org (click the LTS button) | Accept defaults |
| **PostgreSQL 16** | the database | https://www.postgresql.org/download/windows/ | Remember the password you set for user `postgres`. Keep port `5432`. |
| **Git** | version control (optional but recommended) | https://git-scm.com/download/win | Accept defaults |
| **VS Code** | code editor | https://code.visualstudio.com | Tick "Add to PATH" |

Restart Windows after installing, then open **PowerShell** (Start → type "PowerShell") and check:

```powershell
node -v      # should print v22.x
npm -v
psql --version
```
If `psql` is "not recognized", add `C:\Program Files\PostgreSQL\16\bin` to your PATH (Start → "Edit the system environment variables" → Environment Variables → Path → New).

## 2. Create the database

```powershell
psql -U postgres -c "CREATE DATABASE chickenmart;"
```
Enter your postgres password when asked.

## 3. Get the project and install packages

Open the project folder in VS Code (File → Open Folder). Open the terminal inside VS Code (Ctrl + `) — it must show the project folder path. Then:

```powershell
npm install
copy .env.example .env
```
Open `.env` and set (use your own password):
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/chickenmart
```

## 4. Create the tables and starter data

```powershell
npx drizzle-kit push
npx tsx scripts/seed.ts
```
`drizzle.config.json` has a hard-coded database address — if your database name/password differ from `app_db` / `postgres`, edit the `url` there too.

## 5. Start the app

```powershell
npm run dev
```
Open http://localhost:3000 — you should see the Chicken Mart home page with products.

## 6. Check that it works

1. Click **Sign up**, create an account, add a few products to the cart, open the cart.
2. Checkout → add an address with PIN `500081` → pick a slot → **Cash on delivery** → Place order.
3. Open `/login` in a private window, log in as the admin (`admin@chickenmart.in` / `Admin@12345`) → Orders → open your order → change status to **Accepted → Preparing → Ready for dispatch**, assign **Ravi Kumar**.
4. In another private window log in as the rider (`9000000002` / `Delivery@123`) → accept → start → mark delivered.
5. Back in your customer window the order shows **Delivered**.

## Common errors

| Message | Fix |
|---|---|
| `password authentication failed` | Wrong password in `DATABASE_URL` (and `drizzle.config.json`). |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL service is not running: Start → Services → postgresql → Start. |
| `'npx' is not recognized` | Close and reopen the terminal after installing Node. |
| Port 3000 busy | `npm run dev -- -p 3001` |
| PowerShell blocks scripts | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
