# Printing

Design: [ADR-005](adr/ADR-005-printing.md).

- **Code today:** `apps/pos-ui/lib/print/` — ESC/POS builder (`escpos.ts`), LAN TCP 9100 (`network.ts`), routing
  (`router.ts`: KOT → kitchen printer, bill → counter printer), queue (`manager.ts`, `PrintJob` table).
- **Target:** routing/queue in `modules/printing`, ESC/POS builders and drivers in `adapters/printer-escpos`.
- **Setup:** see [runbooks/printer-setup.md](runbooks/printer-setup.md).
