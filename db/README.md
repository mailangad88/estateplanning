# Database

Postgres 15+. `schema.sql` creates every table, the access helpers, views, triggers and row-level security (RLS).

## Apply

Run as the schema owner (a superuser, because it creates the `rls_helper` role with `BYPASSRLS`):

    psql "$DATABASE_URL_OWNER" -v ON_ERROR_STOP=1 -f db/schema.sql

Then `GRANT app_user TO <web login role>;` and `GRANT app_service TO <worker login role>;`. Migrations always run as the owner, never as the app.

## Per-request session settings

RLS reads who is calling from transaction-local settings. The app must open a transaction per request and set them first, with `set_config(..., true)` (the `SET LOCAL` equivalent that accepts parameters):

    BEGIN;
    SELECT set_config('app.user_id', $1, true), set_config('app.role', $2, true),
           set_config('app.firm_id', $3, true), set_config('app.lawyer_id', $4, true),
           set_config('app.person_id', $5, true), set_config('app.supports_lawyer_ids', $6, true); -- comma list
    -- queries ...
    COMMIT;

Use empty strings for values that do not apply. Missing or empty settings mean "nobody": every lead check returns `none`. Never set them outside a transaction on a pooled connection, or they can leak to the next request.

## Notes

- RLS is the second layer behind `src/server/auth/policy.ts`. The SQL mirrors `leadAccess`, `canOnLead` and the comment visibility rules; change both together.
- Offer-stage lawyers read `lead_offer_cards` only. They have no path to `leads.intake`.
- Clients read consults through `client_consults` (no notes). Marketing reads `lead_funnel_daily` (counts, no PII).
- `audit_events`, `fee_rule_versions` and `fact_verifications` are append-only (no grants plus triggers). Chain the next audit hash from `SELECT * FROM audit_last()`.
- Workers (public intake, e-sign webhooks, nurture, routing accept) connect as `app_service`, which has its own policies and is never used for user-driven requests.
