import React from 'react';
import { IndianRupee, Wallet, Banknote, Smartphone, CreditCard, Receipt, ReceiptText, BriefcaseBusiness, TrendingUp, TrendingDown, DollarSign, RotateCcw, BadgePercent, CircleDollarSign, Truck, Users, FileBadge2, Landmark, Building2, PiggyBank, ArrowRightLeft, FileSpreadsheet, ChartColumn, BookOpen, ArrowLeftRight, TriangleAlert } from 'lucide-react';

interface PrimaryKPIsProps {
  todayRevenue: string;
  netCash: string;
  todayExpenses: string;
  profitToday: string;
}

export const PrimaryKPIs: React.FC<PrimaryKPIsProps> = ({ todayRevenue, netCash, todayExpenses, profitToday }) => {
  const cards = [
    { label: "Today's Revenue", value: todayRevenue, icon: <TrendingUp className="w-4 h-4" />, color: "var(--primary-orange)" },
    { label: "Net Cash", value: netCash, icon: <DollarSign className="w-4 h-4" />, color: "var(--positive-green)" },
    { label: "Today's Expenses", value: todayExpenses, icon: <TrendingDown className="w-4 h-4" />, color: "var(--negative-red)" },
    { label: "Profit Today", value: profitToday, icon: <TrendingUp className="w-4 h-4" />, color: "var(--primary-orange)" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <div
          key={i}
          className="card p-3 flex flex-col justify-between hover:-translate-y-1 transition duration-200 cursor-pointer"
          style={{ background: "var(--paper-2)", boxShadow: "var(--sh-1)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full" style={{ background: c.color, color: "white" }}>{c.icon}</span>
            <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--ink-3)" }}>{c.label}</span>
          </div>
          <span className="block text-2xl font-extrabold" style={{ color: "var(--ink)" }}>{c.value}</span>
        </div>
      ))}
    </div>
  );
};
