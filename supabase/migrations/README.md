# Database migrations: moved

Decided by the owner on 2026-11-12 (ADR-001 in the household repository,
`engineering/decisions/ADR-001-database-schema-ownership.md`): **new database
migrations go in `trashdrop/supabase/migrations/` of
apaloo/TrashDrop-Mobile-User-Domestic**, for all three apps. The files here
stay as history. A pull request here that needs a schema change links the
household pull request that makes it.

The household repository's daily security watch checks that every migration
production has recorded has its file in one of the three repositories.
