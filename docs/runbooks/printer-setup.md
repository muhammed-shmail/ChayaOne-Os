# Printer setup

1. Connect each thermal printer to the cafe Wi-Fi/LAN.
2. In the router, reserve a fixed IP for each printer (DHCP reservation), e.g. kitchen `192.168.1.100`, counter `192.168.1.101`.
3. Enable RAW TCP printing on port 9100 on the printer.
4. In Dashboard → Settings → Printers, add each printer (kitchen = KOT, counter = bill) and run a test print.
5. If printing stops after a router restart, check the printer kept its IP.
