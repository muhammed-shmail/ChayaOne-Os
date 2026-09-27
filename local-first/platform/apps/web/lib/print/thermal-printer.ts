/**
 * Shared Thermal Print Service for browser / client-side printing.
 *
 * Renders the HTML bill into a hidden, detached iframe and triggers
 * the OS/browser print spooler directly to the thermal printer (e.g. TVSE RP3200 Lite)
 * with zero popup intermediate screens.
 *
 * Used identically across:
 * 1. Billing Configuration → Test Print
 * 2. POS / Waiter → Print Bill
 * 3. T-Billing → Print Bill / Settle / Reprint
 */
export function printThermalReceipt(title: string, htmlContent: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const jid = `thermal-${Date.now()}`;
    console.log(`[THERMAL PRINT SERVICE] Dispatching print job "${title}" (${jid})`);

    // Clean up any existing stale print iframes
    const existing = document.getElementById('chayaone-thermal-print-frame');
    if (existing) {
      try {
        existing.remove();
      } catch {}
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'chayaone-thermal-print-frame';
    iframe.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      try {
        iframe.remove();
      } catch {}
      console.error('[THERMAL PRINT SERVICE] Could not access iframe document');
      resolve(false);
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    const iframeWin = iframe.contentWindow;
    const cleanup = () => {
      setTimeout(() => {
        try {
          iframe.remove();
        } catch {}
      }, 3000);
    };

    if (!iframeWin) {
      cleanup();
      resolve(false);
      return;
    }

    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      try {
        iframeWin.focus();
        iframeWin.print();
        console.log(`[THERMAL PRINT SERVICE] Print dialog launched for "${title}"`);
        resolve(true);
      } catch (err) {
        console.error('[THERMAL PRINT SERVICE] Print error:', err);
        resolve(false);
      } finally {
        cleanup();
      }
    };

    // Wait for images (e.g. logo, SVG QR) to be fully rendered
    const imgs = Array.from(doc.images || []);
    if (imgs.length === 0) {
      setTimeout(triggerPrint, 100);
    } else {
      let remaining = imgs.length;
      const onReady = () => {
        remaining--;
        if (remaining <= 0) setTimeout(triggerPrint, 80);
      };
      imgs.forEach((img) => {
        if (img.complete && img.naturalWidth > 0) onReady();
        else {
          img.addEventListener('load', onReady);
          img.addEventListener('error', onReady);
        }
      });
      // Safety timeout in case an image hangs
      setTimeout(triggerPrint, 1500);
    }
  });
}
