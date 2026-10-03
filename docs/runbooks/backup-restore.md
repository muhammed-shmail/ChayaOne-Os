# Backup and restore

- Backups: Dashboard → System → Backups (code: `apps/pos-ui/lib/system/backup-manager.ts`).
- ⚠️ Current backups are JSON snapshots limited to 5,000 rows per table and stored on the same PC — see the audit.
  Until replaced by `pg_dump`, also copy `C:\ProgramData\ChayaOne` to external storage regularly.
