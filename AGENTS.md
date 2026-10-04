
- Erplain writes (CreateManufacturingOrder only) are gated by server secret ERPLAIN_ALLOW_WRITE=true plus explicit admin confirm; otherwise dry run — prevents accidental real MOs.
- Workshop plan is computed server-side in supabase/functions/erplain-sync/plan.ts from erplain_* tables — create_mo re-validates with the same code.
- Workshop plan selection: explicit allocations (line reservations, MOs linked to lines) stay with their own lines; only free stock/unlinked MO output covers selected lines — avoids double counting.
