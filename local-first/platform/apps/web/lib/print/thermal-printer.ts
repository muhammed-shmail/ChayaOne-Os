/**
 * thermal-printer.ts
 * Standalone (non-React) thermal receipt printing utility.
 *
 * Uses a hidden iframe -> window.print() pipeline, identical to the
 * printThermal80mm function inside PosClient.tsx, but without any
 * React state dependencies (no flash toast, no activePrintJobs ref).
 *
 * Returns Promise<boolean> — true if the print dialog was successfully
 * launched, false if it failed (so callers can show their own error UI).
 */

/** Tracks in-flight print jobs to prevent duplicate prints */
const _activeJobs = new Set<string>();

let _jobCounter = 0;
function _nextJobId(prefix: string): string {
  _jobCounter += 1;
  return `${prefix}-${Date.now()}-${_jobCounter}`;
}

/** Helper to detect mobile phone or tablet browsers */
export function isMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || window.innerWidth < 768;
}

/**
 * Print an HTML receipt document using a hidden iframe.
 * Accepts either a full `<!DOCTYPE html>` document or a bare HTML fragment.
 * If a fragment is passed it is wrapped in a standard 80mm thermal shell.
 *
 * @param title   - Window/tab title for the print dialog
 * @param htmlBody - Full HTML doc or inner HTML fragment to print
 * @param jobId   - Optional dedup key (auto-generated if omitted)
 * @param options - Options including allowMobilePopup to selectively permit print dialogs on mobile
 * @returns Promise<boolean> — true = print dialog launched or handled, false = error
 */
export function printThermalReceipt(
  title: string,
  htmlBody: string,
  jobId?: string,
  options?: { allowMobilePopup?: boolean },
): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false); // SSR guard

  // If on mobile device / tablet and mobile popup is not explicitly allowed,
  // suppress the browser window.print() OS dialog to prevent unwanted print popups on waiter/owner mobile phones!
  if (isMobileBrowser() && !options?.allowMobilePopup) {
    console.log(`[THERMAL] Suppressed browser window.print() on mobile device (silent LAN print handles it). Title: ${title}`);
    return Promise.resolve(true);
  }

  const jid = jobId || _nextJobId('thermal-receipt');

  if (_activeJobs.has(jid)) {
    console.warn(`[THERMAL] Duplicate print blocked - Job ID: ${jid}`);
    return Promise.resolve(false);
  }
  _activeJobs.add(jid);

  console.log(`[THERMAL] -- Print Job START --`);
  console.log(`[THERMAL] Job ID   : ${jid}`);
  console.log(`[THERMAL] Title    : ${title}`);
  console.log(`[THERMAL] Method   : hidden-iframe -> window.print()`);
  console.log(`[THERMAL] Time     : ${new Date().toISOString()}`);

  const html = htmlBody.trimStart().startsWith('<!DOCTYPE html')
    ? htmlBody
    : `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/>
<title>${escHtml(title)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    width: 72mm;
    font-family: 'Courier New', Courier, 'Lucida Console', monospace;
    font-size: 11pt;
    line-height: 1.35;
    color: #000;
    background: #fff;
  }
  .receipt { width: 100%; padding: 0; }
  .store-name { text-align:center; font-size:15pt; font-weight:900;
                letter-spacing:1px; text-transform:uppercase;
                line-height:1.2; margin-bottom:2pt; }
  .store-sub  { text-align:center; font-size:9pt; color:#222;
                line-height:1.3; margin-bottom:1pt; }
  .doc-title  { text-align:center; font-size:10pt; font-weight:700;
                letter-spacing:2px; text-transform:uppercase;
                margin:3pt 0 2pt; }
  .div-solid  { border-top:1.5px solid #000; margin:3pt 0; }
  .div-dashed { border-top:1px dashed #000; margin:3pt 0; }
  .meta-row   { display:flex; justify-content:space-between;
                font-size:9pt; line-height:1.3; }
  .meta-row.bold { font-weight:700; font-size:9.5pt; }
  .items-hdr  { display:flex; font-size:9pt; font-weight:700;
                text-transform:uppercase; padding-bottom:2pt; }
  .col-name   { flex:1; }
  .col-qty    { width:22pt; text-align:center; }
  .col-rate   { width:30pt; text-align:right; }
  .col-amt    { width:36pt; text-align:right; }
  .item-row   { display:flex; font-size:10pt; line-height:1.35;
                padding:1pt 0; align-items:flex-start; }
  .item-name  { flex:1; word-break:break-word; }
  .item-note  { font-size:8.5pt; color:#333; padding-left:6pt; }
  .totals-row { display:flex; justify-content:space-between;
                font-size:10pt; line-height:1.4; }
  .totals-row.grand    { font-size:13pt; font-weight:900; margin:2pt 0; }
  .totals-row.discount { color:#1a7a1a; }
  .pay-row    { display:flex; justify-content:space-between;
                font-size:10pt; line-height:1.4; }
  .pay-row.change { font-weight:700; }
  .footer     { text-align:center; font-size:9pt; color:#333;
                margin-top:4pt; line-height:1.4; }
  .footer .thank-you { font-size:11pt; font-weight:700; color:#000;
                       margin-bottom:2pt; }
  .watermark  { text-align:center; font-size:10pt; font-weight:700;
                letter-spacing:1px; border:1.5px solid #000;
                padding:2pt 4pt; margin-bottom:3pt; }
  .logo-wrap  { text-align:center; margin-bottom:3pt; }
  .logo-wrap img { max-height:14mm; max-width:40mm; object-fit:contain; }
  @media screen {
    body { background:#f5f5f5; padding:8px; }
    .receipt { background:#fff; padding:8px; box-shadow:0 0 12px rgba(0,0,0,0.15); }
  }
</style>
</head><body>
<div class="receipt">
${htmlBody}
</div>
</body></html>`;

  return new Promise<boolean>((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;' +
      'border:none;opacity:0;pointer-events:none;';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      console.error(`[THERMAL] Could not access iframe document. Job: ${jid}`);
      _activeJobs.delete(jid);
      try { document.body.removeChild(iframe); } catch {}
      return resolve(false);
    }

    doc.open();
    doc.write(html);
    doc.close();

    const iframeWin = iframe.contentWindow;
    const cleanup = () => {
      _activeJobs.delete(jid);
      try { document.body.removeChild(iframe); } catch {}
    };

    if (!iframeWin) {
      console.error(`[THERMAL] No iframe window. Job: ${jid}`);
      cleanup();
      return resolve(false);
    }

    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      try {
        console.log(`[THERMAL] Opening print dialog - Job: ${jid}`);
        iframeWin.focus();
        iframeWin.print();
        console.log(`[THERMAL] Print dialog launched - Job: ${jid}`);
        setTimeout(cleanup, 2500);
        resolve(true);
      } catch (err: any) {
        console.error(`[THERMAL] Print error - Job: ${jid} - ${err?.message || err}`);
        setTimeout(cleanup, 2500);
        resolve(false);
      }
    };

    const imgs = Array.from(doc.images || []);
    if (imgs.length === 0) {
      setTimeout(triggerPrint, 80);
    } else {
      let remaining = imgs.length;
      const onReady = () => { if (--remaining <= 0) setTimeout(triggerPrint, 60); };
      imgs.forEach((img) => {
        if ((img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0) {
          onReady();
        } else {
          img.onload = onReady;
          img.onerror = onReady;
        }
      });
      // Safety fallback
      setTimeout(triggerPrint, 1200);
    }
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
