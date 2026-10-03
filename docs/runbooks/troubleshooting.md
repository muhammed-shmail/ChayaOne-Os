# Troubleshooting

| Symptom | Check |
|---|---|
| Login / any page returns 500 | Local DB not running → `npm run db:local` |
| Waiter phones can't connect | Phone on the same Wi-Fi; Main PC IP unchanged; port 3000 allowed in the firewall |
| KOT not printing | Printer IP fixed and reachable; port 9100; Dashboard print queue status |
| Owner app shows no data | Cloud sync endpoint not built yet (see SYNC.md) |
