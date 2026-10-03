# Database recovery

- Development: the embedded database must run in its own terminal: `npm run db:local` (port 5433).
  If login returns HTTP 500, the database is not running.
- Installed hub: the desktop app starts PostgreSQL automatically; logs are in the app's user-data folder (`postgres.log`).
- Data folder (installed): `C:\ProgramData\ChayaOne\data`.
