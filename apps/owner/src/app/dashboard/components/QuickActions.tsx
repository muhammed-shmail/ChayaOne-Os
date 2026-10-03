import React, { useState } from 'react';
import { Plus, Banknote, ArrowRight, Users, ChevronDown, FileSpreadsheet } from 'lucide-react';

interface QuickActionsProps {
  onRecordExpense: () => void;
  onCashMovement: () => void;
  onPaySupplier: () => void;
  onGenerateReport: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onRecordExpense,
  onCashMovement,
  onPaySupplier,
  onGenerateReport,
}) => {
  const [showMore, setShowMore] = useState(false);

  const secondaryActions = [
    { label: 'Account Transfer', handler: () => {}, icon: <ArrowRight size={14} /> },
    { label: 'Other Action', handler: () => {}, icon: <ChevronDown size={14} /> },
  ];

  return (
    <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
      <h4 className="font-bold mb-3 flex items-center gap-2">
        <span>⚡</span> Quick Financial Actions
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
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
        {/* More Actions */}
        <button
          onClick={() => setShowMore(!showMore)}
          className="btn justify-start gap-2 text-xs py-2 px-3"
          style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
        >
          More Actions ▼
        </button>
        {showMore && (
          <div className="col-span-2 md:col-span-4 lg:col-span-5 grid gap-2 mt-2">
            {secondaryActions.map((a, i) => (
              <button
                key={i}
                onClick={a.handler}
                className="btn justify-start gap-2 text-xs py-2 px-3"
                style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
