# ADR-005: Printing

**Status:** Accepted · **Date:** 2026-10-03

## Context
Today the cafe PC sends ESC/POS bytes to printers over TCP 9100 on the LAN. A cloud server cannot reach a printer inside the cafe.

## Decision
Printing is always done from inside the cafe: the hub (PC or tablet app) prints to LAN/Bluetooth/USB printers. Print jobs are queued in `PrintJob`; the hub claims jobs per outlet with locking, retries with a limit, and reports done/failed.

## Consequences
- Printers need fixed IPs (router DHCP reservation).
- Browsers cannot print to a printer IP; the tablet hub must be a native app.
