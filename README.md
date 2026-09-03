# ResolveDesk — Vercel deployment

This version is structured for Vercel's Express/serverless runtime.

## Required Vercel environment variables

- `DATABASE_URL` — Neon Postgres connection string
- `ADMIN_TOKEN` — long random secret used by the admin page

Do not commit these values to GitHub.

## Deploy

1. Upload/import this repository into Vercel.
2. Keep Framework Preset as `Other` if Vercel asks.
3. Leave Build Command empty.
4. Leave Output Directory empty.
5. Leave Install Command at its default.
6. Add `DATABASE_URL` and `ADMIN_TOKEN` under Project Settings → Environment Variables.
7. Redeploy.
8. Test `/api/health`. It should return `{ "ok": true, "database": true }`.

The database tables are created automatically on the first successful request.

## Important

This build intentionally does not collect bank/IBAN credentials or execute cryptocurrency payouts. It is a case-management portal for legitimate assistance workflows.

Never request or store seed phrases, private keys, passwords, or remote-control access.


## Payment details

The case form includes bank name, account holder name, account number, and bank country for an approved payment workflow.

Important:
- Payment details are not returned by the public `/api/cases/:id` endpoint.
- They are returned only from the authenticated admin endpoint.
- Do not request or store PINs, OTPs, passwords, card CVVs, seed phrases, or private keys.
- For real production use, add field-level encryption and a formal privacy/data-retention policy before collecting financial information.
