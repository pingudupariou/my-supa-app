
- Erplain writes (CreateManufacturingOrder only) are gated by server secret ERPLAIN_ALLOW_WRITE=true plus explicit admin confirm; otherwise dry run — prevents accidental real MOs.
- Workshop plan is computed server-side in supabase/functions/erplain-sync/plan.ts from erplain_* tables — create_mo re-validates with the same code.
- Workshop plan selection: explicit allocations (line reservations, MOs linked to lines) stay with their own lines; only free stock/unlinked MO output covers selected lines — avoids double counting.
- Erplain MO references come from DB sequence erplain_mo_reference_seq + prefix in erplain_mo_settings, sent as label on real sends only — numbers never reused when prefix changes.
- Order selection column visibility is persisted on the current device, independently of calculations — hiding a column must never change selected lines or quantities.
- Customer names are synced with orders using only scalar name fields verified in the cached Customer definition — avoids guessed Erplain API fields.
