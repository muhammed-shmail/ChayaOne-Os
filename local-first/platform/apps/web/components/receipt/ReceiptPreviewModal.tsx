'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { formatReceiptModel, type FormattedReceiptModel, type ReceiptInputData } from '@/lib/print/receipt-formatter';
import { generateQrDataUrl } from '@/lib/print/qr';
import { formatINR } from '@cafeos/core';
import type { ReceiptPaperWidth } from '@/lib/receipt';
import { Printer, RefreshCw, X, CheckCircle, AlertTriangle, QrCode } from 'lucide-react';

export interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ReceiptInputData;
  onPrint?: (width: ReceiptPaperWidth) => Promise<void> | void;
  onReprint?: (width: ReceiptPaperWidth) => Promise<void> | void;
  isReprint?: boolean;
}

export default function ReceiptPreviewModal({
  isOpen,
  onClose,
  data,
  onPrint,
  onReprint,
  isReprint = false,
}: ReceiptPreviewModalProps) {
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>(
    data.receiptConfig?.paperWidth === '58mm' ? '58mm' : '80mm'
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printSuccess, setPrintSuccess] = useState<string | null>(null);

  // Compute model using single source of truth
  const model: FormattedReceiptModel = useMemo(() => {
    return formatReceiptModel(
      {
        ...data,
        isReprint: isReprint || data.isReprint,
      },
      paperWidth
    );
  }, [data, paperWidth, isReprint]);

  // Generate offline QR Code when UPI URI is present
  useEffect(() => {
    let active = true;
    if (model.showUpiQr && model.upiResult.uri) {
      generateQrDataUrl(model.upiResult.uri, {
        scale: paperWidth === '58mm' ? 4 : 5,
        margin: 2,
      })
        .then((url) => {
          if (active) setQrDataUrl(url);
        })
        .catch(() => {
          if (active) setQrDataUrl(null);
        });
    } else {
      setQrDataUrl(null);
    }
    return () => {
      active = false;
    };
  }, [model.showUpiQr, model.upiResult.uri, paperWidth]);

  if (!isOpen) return null;

  const handleExecutePrint = async () => {
    if (!onPrint || isPrinting) return;
    setIsPrinting(true);
    setPrintError(null);
    setPrintSuccess(null);
    try {
      await onPrint(paperWidth);
      setPrintSuccess('Receipt sent to thermal printer');
      setTimeout(() => setPrintSuccess(null), 3000);
    } catch (err: any) {
      setPrintError(err?.message || 'Printer unavailable. Check connection and retry.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleExecuteReprint = async () => {
    if (!onReprint || isPrinting) return;
    setIsPrinting(true);
    setPrintError(null);
    setPrintSuccess(null);
    try {
      await onReprint(paperWidth);
      setPrintSuccess('Reprint job queued');
      setTimeout(() => setPrintSuccess(null), 3000);
    } catch (err: any) {
      setPrintError(err?.message || 'Reprint failed. Check printer connection.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Preview container width styles
  const is58 = paperWidth === '58mm';
  const containerWidthClass = is58 ? 'max-w-[320px]' : 'max-w-[420px]';

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex flex-col bg-[#1A130F] text-[#EDE4DC] rounded-3xl border border-[#3D2C21] shadow-2xl overflow-hidden my-auto max-h-[95vh] w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2E2018] bg-[#140E0A]">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-extrabold tracking-wide text-[#E8A838]">RECEIPT PREVIEW</span>
            {model.showUpiQr && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-[#E8A838]/20 text-[#E8A838] flex items-center gap-1">
                <QrCode size={12} /> UPI QR: ₹{model.totalPaise / 100}
              </span>
            )}
          </div>

          {/* 58mm / 80mm Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#231710] border border-[#3D2C21]">
            <button
              onClick={() => setPaperWidth('58mm')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                is58 ? 'bg-[#E8A838] text-[#1A130F] shadow' : 'text-[#A8988C] hover:text-white'
              }`}
            >
              58mm
            </button>
            <button
              onClick={() => setPaperWidth('80mm')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                !is58 ? 'bg-[#E8A838] text-[#1A130F] shadow' : 'text-[#A8988C] hover:text-white'
              }`}
            >
              80mm
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#A8988C] hover:text-white hover:bg-[#2E2018] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Paper Receipt Simulation Scrollport */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0E0A08] flex justify-center items-start">
          <div
            className={`w-full ${containerWidthClass} bg-[#FDFBF7] text-[#16120E] p-5 sm:p-6 shadow-xl rounded-md font-mono text-xs leading-relaxed select-text border border-[#E6DEC8] transition-all`}
            style={{
              fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
              boxShadow: '0 10px 30px -5px rgba(0,0,0,0.5)',
            }}
          >
            {/* Watermark for Reprint / Cancelled */}
            {model.isReprint && (
              <div className="text-center font-bold text-xs tracking-widest text-[#B45309] pb-2 border-b border-dashed border-[#16120E]/30 mb-2">
                *** REPRINT ***
              </div>
            )}
            {model.isCancelled && (
              <div className="text-center font-bold text-sm tracking-wider text-[#DC2626] pb-2 border-b border-dashed border-[#16120E]/30 mb-2">
                *** CANCELLED / VOID ***
              </div>
            )}

            {/* Shop Logo (if configured) */}
            {model.logoUrl && (
              <div className="flex justify-center mb-2">
                <img
                  src={model.logoUrl}
                  alt={model.storeName}
                  className="max-h-12 max-w-[120px] object-contain"
                />
              </div>
            )}

            {/* Shop Name & Header */}
            <div className="text-center space-y-0.5">
              <h2 className="font-extrabold text-sm sm:text-base tracking-wider uppercase text-black">
                {model.storeName}
              </h2>
              {model.addressText && <p className="text-[11px] text-[#4A4036]">{model.addressText}</p>}
              {model.contactLine && <p className="text-[11px] text-[#4A4036]">{model.contactLine}</p>}
              {model.headerNote && <p className="text-[11px] text-[#6B5E52] italic">{model.headerNote}</p>}
            </div>

            {/* Divider */}
            <div className="my-2.5 border-t border-dashed border-[#16120E]/40" />

            {/* Table & Order Row (SAME LINE) */}
            <div className="flex justify-between font-bold text-black text-[11px]">
              <span className="uppercase">{model.tableAndOrderRow.split(/\s{2,}/)[0]}</span>
              <span>{model.tableAndOrderRow.split(/\s{2,}/)[1]}</span>
            </div>

            {/* Date & Time Row (SAME LINE) */}
            <div className="flex justify-between text-[11px] text-[#4A4036] mt-0.5">
              <span>{model.dateTimeRow.split(/\s{2,}/)[0]}</span>
              <span>{model.dateTimeRow.split(/\s{2,}/)[1]}</span>
            </div>

            {/* Divider */}
            <div className="my-2.5 border-t border-dashed border-[#16120E]/40" />

            {/* Column Headers */}
            <div className="flex justify-between font-bold text-[11px] text-black uppercase pb-1 border-b border-[#16120E]/20">
              <span>ITEM</span>
              <div className="flex gap-4">
                <span>QTY</span>
                <span className="min-w-[50px] text-right">AMOUNT</span>
              </div>
            </div>

            {/* Items List */}
            <div className="py-2 space-y-1.5 text-[11px]">
              {model.itemLines.map((line, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-black pr-2 break-words flex-1">{line.name}</span>
                    <div className="flex gap-4 shrink-0 font-medium">
                      <span className="w-6 text-center">{line.qtyText.trim()}</span>
                      <span className="min-w-[50px] text-right font-semibold">{line.amountText.trim()}</span>
                    </div>
                  </div>
                  {/* Extra wrapped lines or modifiers */}
                  {line.extraLines.map((extra, eIdx) => (
                    <div key={eIdx} className="text-[10px] text-[#6B5E52] pl-2 whitespace-pre-wrap">
                      {extra}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="my-2 border-t border-dashed border-[#16120E]/40" />

            {/* Subtotal, Discounts, Taxes */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#4A4036]">Subtotal</span>
                <span className="font-medium">{model.subtotalText}</span>
              </div>

              {model.taxBreakdown.map((t, idx) => (
                <div key={idx} className="flex justify-between text-[#4A4036]">
                  <span>{t.label}</span>
                  <span>{t.amountText}</span>
                </div>
              ))}

              {model.discountText && (
                <div className="flex justify-between font-bold text-[#15803D]">
                  <span>Discount</span>
                  <span>{model.discountText}</span>
                </div>
              )}

              {model.roundOffText && (
                <div className="flex justify-between text-[#4A4036]">
                  <span>Round Off</span>
                  <span>{model.roundOffText}</span>
                </div>
              )}
            </div>

            {/* Final Total */}
            <div className="my-2 border-t border-b border-[#16120E]/40 py-1.5 flex justify-between items-center text-sm font-extrabold text-black">
              <span>TOTAL</span>
              <span className="text-base font-black">{model.totalText}</span>
            </div>

            {/* Dynamic UPI QR Code */}
            {model.showUpiQr && (
              <div className="text-center my-3 pt-1 space-y-1.5">
                <div className="inline-block p-2 bg-white rounded-xl border border-[#E5E0D8] shadow-sm">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="UPI QR Code"
                      className={`mx-auto object-contain ${is58 ? 'w-[120px] h-[120px]' : 'w-[140px] h-[140px]'}`}
                    />
                  ) : (
                    <div className="w-[120px] h-[120px] grid place-items-center text-xs text-gray-400">
                      Generating QR…
                    </div>
                  )}
                </div>
                {model.scanAndPayText && (
                  <p className="font-extrabold text-xs tracking-wide text-black uppercase">
                    {model.scanAndPayText}
                  </p>
                )}
                <div className="my-2 border-t border-dashed border-[#16120E]/40" />
              </div>
            )}

            {/* Footer */}
            <div className="text-center pt-2 text-[11px] text-[#6B5E52] space-y-1">
              {model.footerNote && model.footerNote.toLowerCase() !== 'chaya.one' && (
                <p>{model.footerNote}</p>
              )}
              <p className="font-bold text-xs tracking-wider text-black lowercase">{model.brandingText}</p>
            </div>
          </div>
        </div>

        {/* Feedback Alert if Error or Success */}
        {printError && (
          <div className="px-5 py-2.5 bg-red-950/80 border-t border-red-800 text-red-200 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-red-400" />
              <span>{printError}</span>
            </div>
            <button
              onClick={handleExecutePrint}
              className="px-2.5 py-1 bg-red-800 text-white rounded-lg text-[11px] font-bold hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}
        {printSuccess && (
          <div className="px-5 py-2.5 bg-emerald-950/80 border-t border-emerald-800 text-emerald-200 text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle size={14} className="text-emerald-400" />
            <span>{printSuccess}</span>
          </div>
        )}

        {/* Bottom Action Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[#2E2018] bg-[#140E0A]">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#3D2C21] text-xs font-bold text-[#A8988C] hover:text-white hover:bg-[#231710] transition"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {onReprint && (
              <button
                disabled={isPrinting}
                onClick={handleExecuteReprint}
                className="px-4 py-2.5 rounded-xl border border-[#3D2C21] text-xs font-bold text-[#E8A838] hover:bg-[#231710] transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isPrinting ? 'animate-spin' : ''} /> Reprint
              </button>
            )}

            {onPrint && (
              <button
                disabled={isPrinting}
                onClick={handleExecutePrint}
                className="px-5 py-2.5 rounded-xl bg-[#E8A838] hover:bg-[#F3B344] text-[#1A130F] text-xs font-extrabold transition shadow-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                <Printer size={15} /> {isPrinting ? 'Printing…' : 'Print Receipt'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
