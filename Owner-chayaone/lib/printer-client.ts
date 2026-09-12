export class LocalPrinterClient {
  public static async requestPrint(payload: any) {
    try {
      // Connects to the Desktop App's Express listener
      const response = await fetch('http://127.0.0.1:3001/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        console.error(`LocalPrinterClient error: HTTP ${response.status}`);
      }
    } catch (err: any) {
      console.warn(`LocalPrinterClient failed (Desktop App may not be running): ${err.message}`);
    }
  }
}
