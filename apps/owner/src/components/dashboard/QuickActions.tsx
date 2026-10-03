import React, { useState } from 'react';
import { Plus, Banknote, Users, ChevronDown, FileSpreadsheet } from 'lucide-react';

interface QuickActionsProps {
  onRecordExpense?: () => void;
  onCashMovement?: () => void;
  onPaySupplier?: () => void;
  onGenerateReport?: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onRecordExpense,
  onCashMovement,
  onPaySupplier,
  onGenerateReport,
}) => {
  const [showMore, setShowMore] = useState(false);

  return (
    <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
      <h4 className="font-bold mb-3 flex items-center gap-2">
        <span>⚡</span> Quick Management Actions
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
        <button
          onClick={onRecordExpense}
          className="btn btn-primary justify-start gap-2 text-xs py-2 px-3"
        >
          <Plus size={14} /> Record Expense
        </button>
        <button
          onClick={onCashMovement}
          className="btn justify-start gap-2 text-xs py-2 px-3"
          style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
        >
          <Banknote size={14} /> Cash In / Out
        </button>
        <button
          onClick={onPaySupplier}
          className="btn justify-start gap-2 text-xs py-2 px-3"
          style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
        >
          <Users size={14} /> Pay Supplier
        </button>
        <button
          onClick={onGenerateReport}
          className="btn justify-start gap-2 text-xs py-2 px-3"
          style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
        >
          <FileSpreadsheet size={14} /> Generate Report
        </button>
      </div>
    </section>
  );
};
