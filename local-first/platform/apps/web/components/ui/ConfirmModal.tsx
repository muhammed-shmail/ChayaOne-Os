'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, isLoading, onCancel]);

  // Auto-focus the cancel button when opened for keyboard accessibility & safety
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      onClick={() => {
        if (!isLoading) onCancel();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-paper border border-line rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-150 ring-1 ring-black/10"
        style={{ background: 'var(--paper, #ffffff)', borderColor: 'var(--line, #e2e8f0)' }}
      >
        <div className="flex items-start gap-3.5 mb-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDestructive
                ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
            }`}
          >
            {isDestructive ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-modal-title" className="text-base font-bold text-ink leading-tight">
              {title}
            </h3>
            <div className="text-xs text-ink-3 mt-1.5 leading-relaxed">
              {message}
            </div>
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="text-ink-3 hover:text-ink p-1 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-line/60">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-ink-2 hover:bg-paper-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-turmeric text-[#2A1607] hover:brightness-110'
            }`}
          >
            {isLoading && <Loader2 size={13} className="animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export function useConfirm() {
  const [modalState, setModalState] = useState<(ConfirmOptions & {
    isOpen: boolean;
    resolve: (val: boolean) => void;
  }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setModalState({
        ...options,
        isOpen: true,
        resolve: (val: boolean) => {
          setModalState(null);
          resolve(val);
        },
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (modalState) {
      modalState.resolve(true);
    }
  }, [modalState]);

  const handleCancel = useCallback(() => {
    if (modalState) {
      modalState.resolve(false);
    }
  }, [modalState]);

  const ConfirmDialog = useCallback(() => {
    if (!modalState || !modalState.isOpen) return null;
    return (
      <ConfirmModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        isDestructive={modalState.isDestructive ?? true}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  }, [modalState, handleConfirm, handleCancel]);

  return { confirm, ConfirmDialog };
}
