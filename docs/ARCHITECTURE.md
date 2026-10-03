# ChayaOne — Architecture

- **New developer? Start here:** [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
- **Folder structure and layers:** [ADR-002](adr/ADR-002-folder-structure.md)
- **Language decision:** [ADR-001](adr/ADR-001-keep-typescript.md)
- **Hub + cloud (offline-first):** [ADR-004](adr/ADR-004-sync-strategy.md)
- **Plans / enterprise:** [ADR-003](adr/ADR-003-plans-and-enterprise.md)
- **Printing:** [ADR-005](adr/ADR-005-printing.md)
- **Security & tenancy:** [ADR-006](adr/ADR-006-security-and-tenancy.md)
- **Audit (findings & roadmap):** [ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md)
- **Original specifications:** [spec/](spec/) — as-built overview in [spec/ChayaOne_Architecture.md](spec/ChayaOne_Architecture.md)

## Runtime today
One Next.js app (`apps/pos-ui`, port 3000) serves POS, T-billing, KDS, dashboard, customer pages and every `/api` route.
The waiter (`apps/waiter`, 3002) and customer (`apps/customer`, 3003) PWAs proxy `/api` to it. The Main PC desktop hub
(`apps/hub-pc`) starts embedded PostgreSQL (5433), the server, a WebSocket hub (3001), printers and an optional tunnel.
The owner app (`apps/owner`, 3004) is installed separately.
