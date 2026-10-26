# Waystar Property Management Portal

Property management portal for **SIMCO Developers** projects, run by **Waystar Royco Marketing**.
It will be hosted at **portal.waystarmarketing.com**.

It tracks every unit and plot: ownership, sales and installments, payments, possession and rentals.

| Phase | Scope | Status |
|---|---|---|
| 1 | Schema, RLS, auth, roles, projects/units inventory, clients | ✅ Done |
| 2 | Sales, payment plans, installment generator, payments & receipts, ledgers | Next |
| 3 | Possession, transfers, cancellations, documents | |
| 4 | Rentals, rent invoices, deposits | |
| 5 | Dashboard, reports, PDFs, exports, pg_cron jobs | |

Design docs:
- [Architecture & schema proposal](docs/01-architecture-proposal.md)
- [Business-rule decisions](docs/02-business-rules.md). Read this before changing any money or status logic.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres, Auth, Storage, RLS) ·
react-hook-form + zod · TanStack Table v8 · Recharts · @react-pdf/renderer · decimal.js · Vitest + pgTAP.

## Local setup

Prerequisites:
- Node.js 20+ (24 LTS recommended)
- Docker Desktop, running

```bash
npm install
npx supabase start          # first run downloads the Supabase images
npx supabase status -o env  # copy ANON_KEY / SERVICE_ROLE_KEY / API_URL into .env.local
cp .env.example .env.local  # then paste the values
npm run dev                 # http://localhost:3000
```

Local services:

| Service | URL |
|---|---|
| Supabase Studio | http://127.0.0.1:54323 |
| Mailpit (password-reset emails) | http://127.0.0.1:54324 |

### Test logins (local seed only)

`supabase/seed.sql` creates one user per role:

| Email | Role | Project access |
|---|---|---|
| `admin@waystar.test` | Super Admin | All projects |
| `manager@waystar.test` | Manager | All projects |
| `agent@waystar.test` | Sales Agent | Simco Villas, Simco Square |
| `accounts@waystar.test` | Accounts | All 5 projects |
| `viewer@waystar.test` | Viewer (SIMCO) | All 5 projects |

They all share the password in the header of `seed.sql`. **These accounts must never exist in production.**

### Seed files (letterheads)

`supabase/seed.sql` can't upload files, so after `npm run db:reset` also run:

```bash
npm run db:seed-assets   # uploads supabase/seed-assets/* (e.g. the SIMCO VILLAS letterhead) to local Storage
```

## Printed documents & letterheads

Each project's forms and letters are managed in **Settings → Projects → (project) → Documents & letters**:
- clause wording (versioned)
- the details that fill the blanks
- the project **letterhead** (an A4 PDF)

Every document can be printed three ways:

| Mode | Use it for | Notes |
|---|---|---|
| On letterhead | Email / digital copies | The letterhead PDF is placed behind every page. Both stay vector graphics |
| For pre-printed paper | Printing on letterhead stock | Same layout, no background |
| Plain | Projects without a letterhead | The portal draws its own simple header and footer |

**Margins.** On letterhead pages, text stays inside the margins set in mm.
- Body text starts below the letterhead artwork on every page.
- On page 1, the heading (title, ref no., addressee) sits higher, in the free space beside the artwork.
- The SIMCO VILLAS defaults were measured from its letterhead:
  - logos 11–35 mm from the top
  - tagline down to 74 mm
  - footer rule at 272 mm

**Printing on pre-printed paper.** Print at **100% / Actual size**. "Fit to page" shrinks the page and breaks the alignment.

## Environment variables

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Public anon key; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Used only in `src/lib/supabase/admin.ts` (marked `server-only`), e.g. to create users. Never expose it. |
| `NEXT_PUBLIC_SITE_URL` | server | Base URL for password-reset links, e.g. `https://portal.waystarmarketing.com` |

## Database & migrations

All schema changes are SQL files in `supabase/migrations/`. Never edit the database by hand.

```bash
npx supabase migration new <name>  # create a migration
npx supabase migration up --local  # apply new migrations locally
npm run db:reset                   # rebuild local DB from migrations + seed.sql
npm run db:types                   # regenerate src/types/database.ts after schema changes
```

How the database is set up:
- **Row Level Security** is on for every table.
  - Role helpers live in a non-exposed `private` schema.
  - Super Admins and Managers see every project. Everyone else sees only the projects listed for them in `user_project_access`.
- **No hard deletes through the API.** Super Admins soft-delete records with `soft_delete(table, id, reason)`.
- **Every change is audited** to `activity_log` by triggers. To record a reason with a change, call `select set_config('app.reason', '…', true)` in the same transaction; `update_unit()` does this for you.
- **Unit statuses `booked`, `sold` and `rented` can only be set by sales and leases.** Users can only switch a unit between available, on hold and blocked.
- **Money** is stored as `numeric(14,2)` and handled in TypeScript with `decimal.js`, never JS floats.
- **Dates and times:**
  - Business dates use Asia/Karachi time.
  - Dates display as `DD-MMM-YYYY` (e.g. 22-Oct-2026).
  - Amounts display as `Rs 1,250,000`.

## Tests

```bash
npm test         # Vitest: money, CNIC, dates, CSV, validation
npm run test:db  # pgTAP: RLS per role, guards, RPCs (requires `supabase start`)
npm run lint && npm run typecheck
```

CI (`.github/workflows/ci.yml`) runs all of these on every push.

## Deploying (Vercel + Supabase)

1. **Create the Supabase project.** In the Supabase dashboard, create a project in the region nearest Pakistan (e.g. Singapore or Mumbai).
2. **Link it and push migrations:**
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   Do **not** run `seed.sql` against production. Create the first Super Admin in Supabase Studio:
   1. Go to Auth → Add user.
   2. Run: `update profiles set role = 'super_admin' where email = '…';`
   3. Set `raw_app_meta_data.role` to match.
3. **Set Supabase Auth URLs.** Under Authentication → URL configuration:
   - Site URL: `https://portal.waystarmarketing.com`
   - Redirect URLs: add `https://portal.waystarmarketing.com/auth/callback`
   - Disable sign-ups.
4. **Create the Vercel project.** Import the GitHub repo, then add the four environment variables for Production and Preview.
   Mark `SUPABASE_SERVICE_ROLE_KEY` as **Sensitive**.
5. **Point the custom domain to Vercel:**
   1. In Vercel → Project → Settings → Domains, add `portal.waystarmarketing.com`.
   2. At the DNS host for `waystarmarketing.com`, add this record:

      | Type | Name | Value |
      |---|---|---|
      | `CNAME` | `portal` | `cname.vercel-dns.com` |

   Vercel issues the HTTPS certificate automatically once DNS resolves.

## Project layout

```
supabase/migrations   SQL migrations (source of truth for the schema)
supabase/seed.sql     local sample data
supabase/tests        pgTAP database tests
src/app               routes: (auth) login/reset · (portal) dashboard, projects, units, clients, settings · api/export
src/features/*        per-domain queries, server actions, zod schemas and components
src/components        layout, data table, form fields, shared UI (shadcn in components/ui)
src/lib               supabase clients, auth/session, money, dates, CNIC, CSV
tests                 Vitest unit tests
```
