'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { formatINR } from '@cafeos/core';
import {
  LayoutDashboard, Store, Printer, Package, ClipboardList,
  Plus, Minus, X, Check, User, Settings, Percent,
  Download, Eye, TrendingDown,
  Trash2, Info, CircleAlert, ChefHat, BarChart3, ImageIcon
} from '@/components/ui';
import { PrimaryKPIs } from './components/PrimaryKPIs';
import { KPIGroup } from './components/KPIGroup';
import { QuickActions } from './components/QuickActions';
import { IndianRupee, Wallet, Banknote, Smartphone, CreditCard, Receipt, ReceiptText, BriefcaseBusiness, TrendingUp, RotateCcw, BadgePercent, CircleDollarSign, Truck, Users, FileBadge2, Landmark, Building2, PiggyBank, ArrowRight, ArrowRightLeft, FileSpreadsheet, ChartColumn, BookOpen, ArrowLeftRight, TriangleAlert, Mail } from 'lucide-react';

interface FinanceManagementProps {
  outlet: { name: string; brand: string; plan: string; gstin: string | null };
  staff: { name: string; role: string };
  kpi: any;
  formatINR: (v: number) => string;
}

// Interfaces
interface FinancialTransaction {
  id: string;
  time: string;
  user: string;
  action: string;
  amountPaise: number;
  type: 'inflow' | 'outflow';
  method: string;
  category: string;
  details: string;
}

interface Expense {
  id: string;
  date: string;
  category: string;
  vendor: string;
  amountPaise: number;
  gstPaise: number;
  method: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  recurring: boolean;
  notes?: string;
}

interface VendorBill {
  id: string;
  vendorName: string;
  billNumber: string;
  date: string;
  dueDate: string;
  amountPaise: number;
  gstPaise: number;
  paidAmountPaise: number;
  status: 'unpaid' | 'partial' | 'paid';
}

interface BankAccount {
  id: string;
  name: string;
  type: 'bank' | 'upi' | 'wallet';
  identifier: string;
  balancePaise: number;
}

interface EmployeeSalary {
  id: string;
  name: string;
  role: string;
  baseSalaryPaise: number;
  advancePaise: number;
  bonusPaise: number;
  deductionPaise: number;
  attendanceDays: number;
  paidStatus: 'unpaid' | 'partial' | 'paid';
}

interface AuditLog {
  id: string;
  time: string;
  user: string;
  action: string;
  details: string;
  oldValue: string;
  newValue: string;
  device: string;
}

interface JournalEntry {
  id: string;
  date: string;
  description: string;
  debits: { account: string; amountPaise: number }[];
  credits: { account: string; amountPaise: number }[];
}

interface SelectOption {
  value: string;
  label: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

function CustomSelect({ value, onChange, options, placeholder = 'Select...', className = '' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inp flex justify-between items-center text-left cursor-pointer select-none ${className}`}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <span className="text-slate-400 shrink-0 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div 
          className="absolute left-0 right-0 z-[10000] mt-1 p-1 max-h-[220px] overflow-y-auto rounded-xl border shadow-lg space-y-0.5 select-scrollbar"
          style={{ background: 'var(--paper-2)', borderColor: 'var(--line)', boxShadow: 'var(--sh-3)' }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className="block w-full text-left rounded-lg text-xs font-bold transition duration-150 cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis"
                style={isSelected 
                  ? { background: 'var(--turmeric)', color: '#2A1607', padding: '10px 14px' }
                  : { color: 'var(--ink)', background: 'transparent', padding: '10px 14px' }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--paper-3)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FinanceManagement({ outlet, staff, kpi, formatINR }: FinanceManagementProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'drawer' | 'expenses' | 'vendors' | 'settlements' | 'banks' | 'payroll' | 'accounting' | 'settings'>('overview');

  // Modals state
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Core finance states with local persistence
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [payroll, setPayroll] = useState<EmployeeSalary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  // Cash Drawer specifics
  const [openingBalancePaise, setOpeningBalancePaise] = useState(1500000); // 15,000 INR
  const [cashDrawerActualPaise, setCashDrawerActualPaise] = useState(0);
  const [isShiftActive, setIsShiftActive] = useState(true);

  // Settings configs
  const [varianceLimitPaise, setVarianceLimitPaise] = useState(50000); // 500 INR
  const [requireExpenseApproval, setRequireExpenseApproval] = useState(true);
  const [pettyCashEnabled, setPettyCashEnabled] = useState(true);

  // Modal forms
  const [expenseForm, setExpenseForm] = useState({ category: 'Kitchen Supplies', vendor: '', amount: '', gstRate: '5', method: 'cash', notes: '', recurring: false });
  const [cashForm, setCashForm] = useState({ type: 'deposit', amount: '', method: 'cash', details: '' });
  const [vendorPayForm, setVendorPayForm] = useState({ billId: '', amount: '', method: 'bank_transfer', accountId: '' });
  const [transferForm, setTransferForm] = useState({ fromAccountId: '', toAccountId: '', amount: '' });
  const [journalForm, setJournalForm] = useState({ description: '', debitAcc: 'Cash', debitAmt: '', creditAcc: 'Sales Revenue', creditAmt: '' });
  const [varianceRemark, setVarianceRemark] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Seed initial data if localStorage is empty
  useEffect(() => {
    const cachedTransactions = localStorage.getItem('cafeos_fin_transactions');
    const cachedExpenses = localStorage.getItem('cafeos_fin_expenses');
    const cachedBills = localStorage.getItem('cafeos_fin_bills');
    const cachedAccounts = localStorage.getItem('cafeos_fin_accounts');
    const cachedPayroll = localStorage.getItem('cafeos_fin_payroll');
    const cachedAudits = localStorage.getItem('cafeos_fin_audits');
    const cachedJournals = localStorage.getItem('cafeos_fin_journals');

    if (cachedTransactions) setTransactions(JSON.parse(cachedTransactions));
    else {
      const initialTransactions: FinancialTransaction[] = [
        { id: '1', time: new Date(Date.now() - 3600000).toLocaleString('en-IN'), user: 'Rahul cashier', action: 'Shift Opened', amountPaise: 1500000, type: 'inflow', method: 'cash', category: 'Shift Start', details: 'Register opening balance' },
        { id: '2', time: new Date(Date.now() - 1800000).toLocaleString('en-IN'), user: 'Rahul cashier', action: 'Order #1042', amountPaise: 45000, type: 'inflow', method: 'upi', category: 'Sales', details: 'UPI Payment received' },
        { id: '3', time: new Date(Date.now() - 900000).toLocaleString('en-IN'), user: 'Manager Suresh', action: 'Recorded Expense', amountPaise: 120000, type: 'outflow', method: 'cash', category: 'Kitchen Supplies', details: 'Purchased Fresh Milk & Bread' }
      ];
      setTransactions(initialTransactions);
      localStorage.setItem('cafeos_fin_transactions', JSON.stringify(initialTransactions));
    }

    if (cachedExpenses) setExpenses(JSON.parse(cachedExpenses));
    else {
      const initialExpenses: Expense[] = [
        { id: '1', date: new Date().toLocaleDateString('en-IN'), category: 'Kitchen Supplies', vendor: 'Amul Milk Agency', amountPaise: 120000, gstPaise: 6000, method: 'cash', status: 'approved', approvedBy: 'Owner Amit', recurring: false, notes: 'Milk and Butter supplies' },
        { id: '2', date: new Date().toLocaleDateString('en-IN'), category: 'Electricity', vendor: 'BESCOM', amountPaise: 850000, gstPaise: 0, method: 'bank_transfer', status: 'pending', recurring: true, notes: 'Monthly utility bill' }
      ];
      setExpenses(initialExpenses);
      localStorage.setItem('cafeos_fin_expenses', JSON.stringify(initialExpenses));
    }

    if (cachedBills) setVendorBills(JSON.parse(cachedBills));
    else {
      const initialBills: VendorBill[] = [
        { id: '1', vendorName: 'Big Basket Wholesale', billNumber: 'BB-9982', date: new Date(Date.now() - 172800000).toLocaleDateString('en-IN'), dueDate: new Date(Date.now() + 432000000).toLocaleDateString('en-IN'), amountPaise: 1450000, gstPaise: 72500, paidAmountPaise: 0, status: 'unpaid' },
        { id: '2', vendorName: 'Kitchenware Solutions', billNumber: 'KS-1204', date: new Date(Date.now() - 259200000).toLocaleDateString('en-IN'), dueDate: new Date().toLocaleDateString('en-IN'), amountPaise: 880000, gstPaise: 158400, paidAmountPaise: 300000, status: 'partial' }
      ];
      setVendorBills(initialBills);
      localStorage.setItem('cafeos_fin_bills', JSON.stringify(initialBills));
    }

    if (cachedAccounts) setBankAccounts(JSON.parse(cachedAccounts));
    else {
      const initialAccounts: BankAccount[] = [
        { id: '1', name: 'HDFC Current Account', type: 'bank', identifier: 'XXXX-XXXX-9844', balancePaise: 38245000 },
        { id: '2', name: 'Razorpay POS Merchant', type: 'upi', identifier: 'merchant@razorpay', balancePaise: 1422000 },
        { id: '3', name: 'Petty Cash Box', type: 'wallet', identifier: 'Main Register Drawer', balancePaise: 250000 }
      ];
      setBankAccounts(initialAccounts);
      localStorage.setItem('cafeos_fin_accounts', JSON.stringify(initialAccounts));
    }

    if (cachedPayroll) setPayroll(JSON.parse(cachedPayroll));
    else {
      const initialPayroll: EmployeeSalary[] = [
        { id: '1', name: 'Rahul Sharma', role: 'Cashier', baseSalaryPaise: 1800000, advancePaise: 200000, bonusPaise: 100000, deductionPaise: 0, attendanceDays: 24, paidStatus: 'unpaid' },
        { id: '2', name: 'Lalit Kumar', role: 'Chef', baseSalaryPaise: 2500000, advancePaise: 0, bonusPaise: 0, deductionPaise: 120000, attendanceDays: 23, paidStatus: 'paid' }
      ];
      setPayroll(initialPayroll);
      localStorage.setItem('cafeos_fin_payroll', JSON.stringify(initialPayroll));
    }

    if (cachedAudits) setAuditLogs(JSON.parse(cachedAudits));
    else {
      const initialAudits: AuditLog[] = [
        { id: '1', time: new Date().toLocaleString('en-IN'), user: 'Amit (Owner)', action: 'Config Change', details: 'Modified cash variance limit to 500 INR', oldValue: '200 INR', newValue: '500 INR', device: 'Chrome / Windows 11' }
      ];
      setAuditLogs(initialAudits);
      localStorage.setItem('cafeos_fin_audits', JSON.stringify(initialAudits));
    }

    if (cachedJournals) setJournalEntries(JSON.parse(cachedJournals));
    else {
      const initialJournals: JournalEntry[] = [
        { id: '1', date: new Date().toLocaleDateString('en-IN'), description: 'Monthly Sales Recognition', debits: [{ account: 'Cash Account', amountPaise: 2200000 }], credits: [{ account: 'Sales Revenue', amountPaise: 2200000 }] }
      ];
      setJournalEntries(initialJournals);
      localStorage.setItem('cafeos_fin_journals', JSON.stringify(initialJournals));
    }
  }, []);

  // Helper helper functions to persist state
  const saveTransactions = (next: FinancialTransaction[]) => {
    setTransactions(next);
    localStorage.setItem('cafeos_fin_transactions', JSON.stringify(next));
  };
  const saveExpenses = (next: Expense[]) => {
    setExpenses(next);
    localStorage.setItem('cafeos_fin_expenses', JSON.stringify(next));
  };
  const saveBills = (next: VendorBill[]) => {
    setVendorBills(next);
    localStorage.setItem('cafeos_fin_bills', JSON.stringify(next));
  };
  const saveAccounts = (next: BankAccount[]) => {
    setBankAccounts(next);
    localStorage.setItem('cafeos_fin_accounts', JSON.stringify(next));
  };
  const savePayroll = (next: EmployeeSalary[]) => {
    setPayroll(next);
    localStorage.setItem('cafeos_fin_payroll', JSON.stringify(next));
  };
  const saveAudits = (next: AuditLog[]) => {
    setAuditLogs(next);
    localStorage.setItem('cafeos_fin_audits', JSON.stringify(next));
  };
  const saveJournals = (next: JournalEntry[]) => {
    setJournalEntries(next);
    localStorage.setItem('cafeos_fin_journals', JSON.stringify(next));
  };

  // Calculations for dynamic states
  const totalSalesPaise = useMemo(() => {
    // default back to KPI sales if no custom sales loaded
    return (kpi?.todaySalesPaise ?? 0) + transactions
      .filter((t) => t.category === 'Sales' && t.type === 'inflow')
      .reduce((sum, t) => sum + t.amountPaise, 0);
  }, [kpi, transactions]);

  const cashSalesPaise = useMemo(() => {
    return (kpi?.todaySalesCashPaise ?? (kpi?.todaySalesPaise ? Math.round(kpi.todaySalesPaise * 0.35) : 0)) + transactions
      .filter((t) => t.category === 'Sales' && t.method === 'cash')
      .reduce((sum, t) => sum + t.amountPaise, 0);
  }, [kpi, transactions]);

  const upiSalesPaise = useMemo(() => {
    return (kpi?.todaySalesUpiPaise ?? (kpi?.todaySalesPaise ? Math.round(kpi.todaySalesPaise * 0.6) : 0)) + transactions
      .filter((t) => t.category === 'Sales' && t.method === 'upi')
      .reduce((sum, t) => sum + t.amountPaise, 0);
  }, [kpi, transactions]);

  const cardSalesPaise = useMemo(() => {
    return (kpi?.todaySalesCardPaise ?? (kpi?.todaySalesPaise ? Math.round(kpi.todaySalesPaise * 0.05) : 0)) + transactions
      .filter((t) => t.category === 'Sales' && t.method === 'card')
      .reduce((sum, t) => sum + t.amountPaise, 0);
  }, [kpi, transactions]);

  const creditSalesPaise = useMemo(() => 450000, []); // Mock credit sales: 4,500 INR
  const totalExpensesPaise = useMemo(() => {
    return expenses
      .filter((e) => e.status === 'approved')
      .reduce((sum, e) => sum + e.amountPaise, 0);
  }, [expenses]);

  const expectedCashInDrawerPaise = useMemo(() => {
    const cashInflow = transactions
      .filter((t) => t.method === 'cash' && t.type === 'inflow')
      .reduce((sum, t) => sum + t.amountPaise, 0);
    const cashOutflow = transactions
      .filter((t) => t.method === 'cash' && t.type === 'outflow')
      .reduce((sum, t) => sum + t.amountPaise, 0);
    return openingBalancePaise + cashSalesPaise + cashInflow - cashOutflow;
  }, [openingBalancePaise, cashSalesPaise, transactions]);

  const netCashPaise = expectedCashInDrawerPaise - totalExpensesPaise;
  const pendingVendorPaymentsPaise = useMemo(() => {
    return vendorBills.reduce((sum, b) => sum + (b.amountPaise - b.paidAmountPaise), 0);
  }, [vendorBills]);

  const gstCollectedPaise = useMemo(() => Math.round(totalSalesPaise * 0.05), [totalSalesPaise]); // 5% GST

  // Role Access guards
  const isOwner = staff.role === 'owner';
  const isManager = staff.role === 'manager';
  const isAccountant = staff.role === 'accountant';
  const isCashier = staff.role === 'cashier';

  // Tabs configured per Role
  const allowedTabs = useMemo(() => {
    if (isOwner || isManager) {
      return [
        { key: 'overview', label: '📊 Dashboard' },
        { key: 'drawer', label: '🗄️ Cash Drawer' },
        { key: 'expenses', label: '🧾 Expenses' },
        { key: 'vendors', label: '🤝 Vendors' },
        { key: 'banks', label: '🏦 Bank Accounts' },
        { key: 'settlements', label: '⌛ Settlements' },
        { key: 'payroll', label: '👥 Payroll' },
        { key: 'accounting', label: '📓 Accounting' },
        { key: 'settings', label: '⚙️ Settings' }
      ] as const;
    }
    if (isAccountant) {
      return [
        { key: 'overview', label: '📊 Dashboard' },
        { key: 'expenses', label: '🧾 Expenses' },
        { key: 'vendors', label: '🤝 Vendors' },
        { key: 'banks', label: '🏦 Bank Accounts' },
        { key: 'accounting', label: '📓 Accounting' }
      ] as const;
    }
    // Cashier
    return [
      { key: 'overview', label: '📊 Dashboard' },
      { key: 'drawer', label: '🗄️ Cash Drawer' }
    ] as const;
  }, [isOwner, isManager, isAccountant]);

  // Handle Form Submissions
  const handleRecordExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(expenseForm.amount) || 0;
    const amountPaise = Math.round(amountVal * 100);
    const gstRateVal = parseFloat(expenseForm.gstRate) || 0;
    const gstPaise = Math.round(amountPaise * (gstRateVal / 100));

    const newExpense: Expense = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('en-IN'),
      category: expenseForm.category,
      vendor: expenseForm.vendor || 'General Supplier',
      amountPaise,
      gstPaise,
      method: expenseForm.method,
      status: requireExpenseApproval && !isOwner ? 'pending' : 'approved',
      approvedBy: isOwner ? staff.name : undefined,
      recurring: expenseForm.recurring,
      notes: expenseForm.notes
    };

    saveExpenses([newExpense, ...expenses]);

    // Directly log transaction if pre-approved
    if (newExpense.status === 'approved') {
      const newTransaction: FinancialTransaction = {
        id: Date.now().toString(),
        time: new Date().toLocaleString('en-IN'),
        user: staff.name,
        action: `Paid ${expenseForm.category}`,
        amountPaise,
        type: 'outflow',
        method: expenseForm.method,
        category: expenseForm.category,
        details: `Expense paid to ${newExpense.vendor}`
      };
      saveTransactions([newTransaction, ...transactions]);

      // Deduct from Petty cash box if paid with cash
      if (expenseForm.method === 'cash') {
        const nextAccounts = bankAccounts.map((a) =>
          a.id === '3' ? { ...a, balancePaise: Math.max(0, a.balancePaise - amountPaise) } : a
        );
        saveAccounts(nextAccounts);
      }
    }

    // Audit log
    const newAudit: AuditLog = {
      id: Date.now().toString(),
      time: new Date().toLocaleString('en-IN'),
      user: staff.name,
      action: 'Create Expense',
      details: `Created new expense of ${formatINR(amountPaise)} for ${expenseForm.category}`,
      oldValue: 'N/A',
      newValue: `Expense ID: ${newExpense.id}`,
      device: 'Desktop Terminal'
    };
    saveAudits([newAudit, ...auditLogs]);

    setActiveModal(null);
    setExpenseForm({ category: 'Kitchen Supplies', vendor: '', amount: '', gstRate: '5', method: 'cash', notes: '', recurring: false });
    showToast('Expense successfully recorded!');
  };

  const handleCashMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(cashForm.amount) || 0;
    const amountPaise = Math.round(amountVal * 100);

    const isWithdrawal = cashForm.type === 'withdrawal';

    const newTransaction: FinancialTransaction = {
      id: Date.now().toString(),
      time: new Date().toLocaleString('en-IN'),
      user: staff.name,
      action: isWithdrawal ? 'Cash Withdrawal' : 'Cash Deposit',
      amountPaise,
      type: isWithdrawal ? 'outflow' : 'inflow',
      method: 'cash',
      category: isWithdrawal ? 'Cash Withdrawal' : 'Cash Deposit',
      details: cashForm.details || (isWithdrawal ? 'Withdrew cash from drawer' : 'Added cash to drawer')
    };

    saveTransactions([newTransaction, ...transactions]);

    // Update main register drawer account
    const nextAccounts = bankAccounts.map((a) =>
      a.id === '3' ? { ...a, balancePaise: isWithdrawal ? Math.max(0, a.balancePaise - amountPaise) : a.balancePaise + amountPaise } : a
    );
    saveAccounts(nextAccounts);

    setActiveModal(null);
    setCashForm({ type: 'deposit', amount: '', method: 'cash', details: '' });
    showToast(isWithdrawal ? 'Cash withdrawal logged!' : 'Cash deposit logged!');
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(transferForm.amount) || 0;
    const amountPaise = Math.round(amountVal * 100);

    const fromAcc = bankAccounts.find((a) => a.id === transferForm.fromAccountId);
    const toAcc = bankAccounts.find((a) => a.id === transferForm.toAccountId);

    if (!fromAcc || !toAcc || fromAcc.balancePaise < amountPaise) {
      showToast('Error: Invalid transfer details or insufficient balance!');
      return;
    }

    const nextAccounts = bankAccounts.map((a) => {
      if (a.id === fromAcc.id) return { ...a, balancePaise: a.balancePaise - amountPaise };
      if (a.id === toAcc.id) return { ...a, balancePaise: a.balancePaise + amountPaise };
      return a;
    });

    saveAccounts(nextAccounts);

    const newTransaction: FinancialTransaction = {
      id: Date.now().toString(),
      time: new Date().toLocaleString('en-IN'),
      user: staff.name,
      action: 'Account Transfer',
      amountPaise,
      type: 'outflow',
      method: 'transfer',
      category: 'Bank Transfer',
      details: `Transferred from ${fromAcc.name} to ${toAcc.name}`
    };
    saveTransactions([newTransaction, ...transactions]);

    setActiveModal(null);
    setTransferForm({ fromAccountId: '', toAccountId: '', amount: '' });
    showToast('Transfer completed successfully!');
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    const actualVal = parseFloat(cashDrawerActualPaise.toString()) || 0;
    const actualPaise = Math.round(actualVal * 100);
    const diffPaise = actualPaise - expectedCashInDrawerPaise;

    setIsShiftActive(false);

    // Save final transaction log for Shift close
    const newTransaction: FinancialTransaction = {
      id: Date.now().toString(),
      time: new Date().toLocaleString('en-IN'),
      user: staff.name,
      action: 'Shift Closed (Z Report)',
      amountPaise: actualPaise,
      type: 'outflow',
      method: 'cash',
      category: 'Shift End',
      details: `Expected: ${formatINR(expectedCashInDrawerPaise)}, Actual: ${formatINR(actualPaise)}, Variance: ${formatINR(diffPaise)}. Remarks: ${varianceRemark}`
    };
    saveTransactions([newTransaction, ...transactions]);

    const newAudit: AuditLog = {
      id: Date.now().toString(),
      time: new Date().toLocaleString('en-IN'),
      user: staff.name,
      action: 'Close Shift Z Report',
      details: `Shift closed. Actual: ${formatINR(actualPaise)}, expected: ${formatINR(expectedCashInDrawerPaise)}, variance: ${formatINR(diffPaise)}`,
      oldValue: 'Shift Active',
      newValue: 'Shift Closed',
      device: 'Desktop Terminal'
    };
    saveAudits([newAudit, ...auditLogs]);

    setActiveModal(null);
    setVarianceRemark('');
    showToast('Shift closed and Z Report saved!');
  };

  const handlePayVendor = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(vendorPayForm.amount) || 0;
    const amountPaise = Math.round(amountVal * 100);

    const bill = vendorBills.find((b) => b.id === vendorPayForm.billId);
    if (!bill) return;

    const remainingToPay = bill.amountPaise - bill.paidAmountPaise;
    const payment = Math.min(amountPaise, remainingToPay);

    const nextBills = vendorBills.map((b) => {
      if (b.id === bill.id) {
        const paid = b.paidAmountPaise + payment;
        return {
          ...b,
          paidAmountPaise: paid,
          status: paid >= b.amountPaise ? 'paid' : 'partial'
        } as VendorBill;
      }
      return b;
    });
    saveBills(nextBills);

    // Deduct from bank account
    const nextAccounts = bankAccounts.map((a) =>
      a.id === vendorPayForm.accountId ? { ...a, balancePaise: Math.max(0, a.balancePaise - payment) } : a
    );
    saveAccounts(nextAccounts);

    const newTransaction: FinancialTransaction = {
      id: Date.now().toString(),
      time: new Date().toLocaleString('en-IN'),
      user: staff.name,
      action: `Vendor Payment: ${bill.vendorName}`,
      amountPaise: payment,
      type: 'outflow',
      method: vendorPayForm.method,
      category: 'Vendor Payment',
      details: `Paid bill ${bill.billNumber} for ${bill.vendorName}`
    };
    saveTransactions([newTransaction, ...transactions]);

    setActiveModal(null);
    setVendorPayForm({ billId: '', amount: '', method: 'bank_transfer', accountId: '' });
    showToast('Vendor payment registered successfully!');
  };

  const handleAddJournal = (e: React.FormEvent) => {
    e.preventDefault();
    const debVal = parseFloat(journalForm.debitAmt) || 0;
    const debPaise = Math.round(debVal * 100);

    const newEntry: JournalEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('en-IN'),
      description: journalForm.description,
      debits: [{ account: journalForm.debitAcc, amountPaise: debPaise }],
      credits: [{ account: journalForm.creditAcc, amountPaise: debPaise }]
    };

    saveJournals([newEntry, ...journalEntries]);

    setActiveModal(null);
    setJournalForm({ description: '', debitAcc: 'Cash', debitAmt: '', creditAcc: 'Sales Revenue', creditAmt: '' });
    showToast('Journal Entry recorded!');
  };

  return (
    <div className="flex flex-col gap-5 min-h-[80vh]">
      {/* Redesigned Premium Top Tab Navigation */}
      <div className="flex justify-start sticky top-0 bg-background z-20 pb-3">
        <div 
          className="inline-flex flex-wrap p-1 rounded-full border shadow-sm"
          style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}
          role="tablist"
        >
          {allowedTabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={activeTab === t.key}
              onClick={() => setActiveTab(t.key)}
              className="px-5 py-2.5 rounded-full text-xs font-extrabold transition-all duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap"
              style={activeTab === t.key
                ? { background: 'var(--turmeric)', color: '#2A1607' }
                : { background: 'transparent', color: 'var(--ink-2)' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Toast */}
      {toastMessage && (
        <div className="fixed bottom-10 right-10 z-[9999] px-6 py-3 rounded-full bg-slate-900 text-white font-bold text-sm shadow-lg flex items-center gap-2">
          <span>✔️</span>
          {toastMessage}
        </div>
      )}

      {/* ── 1. DASHBOARD OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
  {/* Primary KPI Cards */}
  <PrimaryKPIs
    todayRevenue={formatINR(totalSalesPaise)}
    netCash={formatINR(netCashPaise)}
    todayExpenses={formatINR(totalExpensesPaise)}
    profitToday={formatINR(Math.max(0, totalSalesPaise - totalExpensesPaise))}
  />

  {/* KPI Groups */}
  <KPIGroup
    title="Revenue Overview"
    items={[
      { label: "Today's Revenue", value: formatINR(totalSalesPaise), icon: <IndianRupee className='w-4 h-4'/> },
      { label: "Cash Collection", value: formatINR(cashSalesPaise), icon: <Banknote className='w-4 h-4'/> },
      { label: "UPI Collection", value: formatINR(upiSalesPaise), icon: <Smartphone className='w-4 h-4'/> },
      { label: "Card Collection", value: formatINR(cardSalesPaise), icon: <CreditCard className='w-4 h-4'/> },
      { label: "Credit Sales", value: formatINR(creditSalesPaise), icon: <Receipt className='w-4 h-4'/> },
    ]}
  />
  <KPIGroup
    title="Collection Summary"
    items={[
      { label: "Net Cash", value: formatINR(netCashPaise), icon: <Wallet className='w-4 h-4'/> },
      { label: "Cash Drawer Bal", value: formatINR(expectedCashInDrawerPaise), icon: <BriefcaseBusiness className='w-4 h-4'/> },
      { label: "GST Collected", value: formatINR(gstCollectedPaise), icon: <FileBadge2 className='w-4 h-4'/> },
    ]}
  />
  <KPIGroup
    title="Outstanding & Liabilities"
    items={[
      { label: "Pending Receivables", value: formatINR(1850000), icon: <CircleDollarSign className='w-4 h-4'/> },
      { label: "Supplier Payments", value: formatINR(pendingVendorPaymentsPaise), icon: <Truck className='w-4 h-4'/> },
      { label: "Salary", value: formatINR(1800000), icon: <Users className='w-4 h-4'/> },
      { label: "Settlement", value: formatINR(1422000), icon: <Landmark className='w-4 h-4'/> },
    ]}
  />
  <KPIGroup
    title="Tax & Discounts"
    items={[
      { label: "Today's Expenses", value: formatINR(totalExpensesPaise), icon: <ReceiptText className='w-4 h-4'/> },
      { label: "Profit Today", value: formatINR(Math.max(0, totalSalesPaise - totalExpensesPaise)), icon: <TrendingUp className='w-4 h-4'/> },
      { label: "Discount Given", value: formatINR(245000), icon: <BadgePercent className='w-4 h-4'/> },
      { label: "Refund Amount", value: formatINR(125000), icon: <RotateCcw className='w-4 h-4'/> },
    ]}
  />
{/* root div continues */}

          {/* Quick Actions Panel */}
          <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
            <h4 className="font-bold mb-3 flex items-center gap-2">
              <span>⚡</span> Quick Financial Actions
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              <button onClick={() => setActiveModal('record_expense')} className="btn btn-primary justify-start gap-2 text-xs py-2 px-3">
                <Plus size={14} /> Record Expense
              </button>
              <button onClick={() => setActiveModal('cash_movement')} className="btn justify-start gap-2 text-xs py-2 px-3" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}>
                <Banknote size={14} /> Cash In / Out
              </button>
              <button onClick={() => setActiveModal('transfer')} className="btn justify-start gap-2 text-xs py-2 px-3" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}>
                <ArrowRight size={14} /> Account Transfer
              </button>
              <button onClick={() => setActiveModal('vendor_pay')} className="btn justify-start gap-2 text-xs py-2 px-3" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}>
                <Users size={14} /> Pay Vendor
              </button>
              <button onClick={() => setActiveModal('x_report')} className="btn justify-start gap-2 text-xs py-2 px-3" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}>
                <FileSpreadsheet size={14} /> Generate X Report
              </button>
              <button onClick={() => setActiveModal('close_shift')} className="btn justify-start gap-2 text-xs py-2 px-3" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}>
                <ClipboardList size={14} /> Z Report (Close Shift)
              </button>
            </div>
          </section>

          {/* Graphs & Charts Container */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Custom SVG Revenue Graph */}
            <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
              <h4 className="font-bold mb-3">📈 Hourly Sales Revenue Trend</h4>
              <div className="flex items-end justify-between h-44 pt-5 pb-2 px-2 border-b" style={{ borderColor: 'var(--line)' }}>
                {[
                  { hour: '09:00', sales: 45000 },
                  { hour: '11:00', sales: 120000 },
                  { hour: '13:00', sales: 340000 },
                  { hour: '15:00', sales: 150000 },
                  { hour: '17:00', sales: 220000 },
                  { hour: '19:00', sales: 480000 },
                  { hour: '21:00', sales: 610000 }
                ].map((val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-2">
                    <div
                      className="w-full max-w-[32px] rounded-t-lg transition-all cursor-pointer relative group"
                      style={{
                        height: `${(val.sales / 610000) * 100}%`,
                        background: 'linear-gradient(to top, var(--turmeric-d), var(--turmeric))',
                      }}
                      title={`${val.hour} · ${formatINR(val.sales)}`}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition duration-150 pointer-events-none whitespace-nowrap">
                        {formatINR(val.sales)}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--ink-3)' }}>{val.hour}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Custom SVG Cash Flow Inflow/Outflow Graph */}
            <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
              <h4 className="font-bold mb-3">📊 Cash Flow Comparison (Daily)</h4>
              <div className="flex items-end justify-around h-44 pt-5 pb-2 px-2 border-b" style={{ borderColor: 'var(--line)' }}>
                {[
                  { day: 'Mon', in: 1800000, out: 950000 },
                  { day: 'Tue', in: 2200000, out: 1200000 },
                  { day: 'Wed', in: 1950000, out: 1400000 },
                  { day: 'Thu', in: 2400000, out: 1100000 },
                  { day: 'Fri', in: 3100000, out: 1800000 },
                  { day: 'Sat', in: 4500000, out: 2100000 },
                  { day: 'Sun', in: 5200000, out: 2600000 }
                ].map((val, i) => (
                  <div key={i} className="flex flex-col items-center justify-end h-full gap-2 w-10">
                    <div className="flex gap-1 items-end h-full">
                      <div
                        className="w-2.5 rounded-t-sm"
                        style={{ height: `${(val.in / 5200000) * 100}%`, background: 'var(--cardamom)' }}
                        title={`Inflow: ${formatINR(val.in)}`}
                      />
                      <div
                        className="w-2.5 rounded-t-sm"
                        style={{ height: `${(val.out / 5200000) * 100}%`, background: 'var(--clay)' }}
                        title={`Outflow: ${formatINR(val.out)}`}
                      />
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--ink-3)' }}>{val.day}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: 'var(--cardamom)' }} /> Cash Inflow</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: 'var(--clay)' }} /> Expenses / Outflow</span>
              </div>
            </section>
          </div>

          {/* Tables and Lists Grid */}
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Recent activity timeline */}
            <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
              <h4 className="font-bold mb-3 flex items-center justify-between">
                <span>🔔 Recent Cash Activities</span>
                <span className="text-xs pill">Live Feed</span>
              </h4>
              <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                {transactions.map((t) => (
                  <div key={t.id} className="flex gap-3 items-start border-b pb-2" style={{ borderColor: 'var(--line)' }}>
                    <span className="text-lg">{t.type === 'inflow' ? '📥' : '📤'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <b className="text-xs truncate">{t.action}</b>
                        <span className="text-xs font-mono font-bold" style={{ color: t.type === 'inflow' ? 'var(--cardamom-d)' : 'var(--clay)' }}>
                          {t.type === 'inflow' ? '+' : '−'} {formatINR(t.amountPaise)}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 truncate">{t.details}</p>
                      <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                        <span>{t.user}</span>
                        <span>{t.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Pending bills / settlements alert card */}
            <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
              <h4 className="font-bold mb-3">📅 Upcoming Vendor Payments</h4>
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                {vendorBills.filter((b) => b.status !== 'paid').map((b) => (
                  <div key={b.id} className="p-3 rounded-xl flex items-center justify-between gap-3 text-xs" style={{ background: 'var(--paper-3)' }}>
                    <div>
                      <b className="block text-slate-800">{b.vendorName}</b>
                      <span className="text-[10px]" style={{ color: 'var(--ink-3)' }}>Bill: {b.billNumber} · Due: {b.dueDate}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold block font-mono">{formatINR(b.amountPaise - b.paidAmountPaise)}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full capitalize ${b.status === 'partial' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Active alerts panel */}
            <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
              <h4 className="font-bold mb-3 flex items-center gap-1.5">
                <CircleAlert size={16} /> Finance Alerts &amp; Tasks
              </h4>
              <div className="flex flex-col gap-2.5">
                {[
                  { text: 'Cash Drawer Variance Limit exceeded alert configured', sev: 'info' },
                  { text: 'HDFC Current Account Statement needs reconciliation', sev: 'warn' },
                  { text: 'Employee Rahul Sharma Advance Salary requires approval', sev: 'critical' },
                  { text: 'GST filing is due in 10 days', sev: 'info' }
                ].map((a, i) => (
                  <div key={i} className="p-3 rounded-xl flex gap-3 items-start border" style={{ borderColor: 'var(--line)', background: 'var(--paper-3)' }}>
                    <span className="text-base leading-none">{a.sev === 'critical' ? '🔴' : a.sev === 'warn' ? '🟠' : '🔵'}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-normal">{a.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ── 2. CASH DRAWER MANAGEMENT TAB ── */}
      {activeTab === 'drawer' && (
        <div className="flex flex-col gap-4">
          <div className="grid lg:grid-cols-[1fr_2fr] gap-4">
            {/* Reconciliation Card */}
            <section className="card p-5 flex flex-col gap-4" style={{ background: 'var(--paper-2)' }}>
              <h4 className="font-bold flex items-center gap-1.5">
                <ClipboardList size={18} /> Shift Reconciliation
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--line)' }}>
                  <span className="text-xs" style={{ color: 'var(--ink-3)' }}>Opening Shift Cash</span>
                  <b className="text-xs font-mono">{formatINR(openingBalancePaise)}</b>
                </div>
                <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--line)' }}>
                  <span className="text-xs" style={{ color: 'var(--ink-3)' }}>Cash Sales Today</span>
                  <b className="text-xs font-mono" style={{ color: 'var(--cardamom-d)' }}>+{formatINR(cashSalesPaise)}</b>
                </div>
                <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--line)' }}>
                  <span className="text-xs" style={{ color: 'var(--ink-3)' }}>Expected Cash Drawer Bal</span>
                  <b className="text-xs font-mono">{formatINR(expectedCashInDrawerPaise)}</b>
                </div>
                <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--line)' }}>
                  <span className="text-xs" style={{ color: 'var(--ink-3)' }}>Shift Status</span>
                  <span className={`text-[10px] px-2 py-0.5 font-bold rounded-full ${isShiftActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isShiftActive ? 'ACTIVE' : 'CLOSED'}
                  </span>
                </div>
              </div>
              {isShiftActive ? (
                <button onClick={() => setActiveModal('close_shift')} className="btn btn-primary w-full mt-2">
                  🔒 Close Shift &amp; Verify Cash
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsShiftActive(true);
                    setOpeningBalancePaise(1500000);
                    showToast('New cash drawer shift started!');
                  }}
                  className="btn btn-dark w-full mt-2"
                >
                  🔓 Start New Shift
                </button>
              )}
            </section>

            {/* Cash Drawer History Timeline */}
            <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
              <h4 className="font-bold mb-3 flex items-center justify-between">
                <span>📋 Cash Drawer Timeline</span>
                <button onClick={() => setActiveModal('cash_movement')} className="btn btn-sm btn-ghost border text-xs gap-1">
                  ＋ Record Cash Movement
                </button>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}>
                      <th className="py-2.5">Time</th>
                      <th className="py-2.5">User</th>
                      <th className="py-2.5">Action</th>
                      <th className="py-2.5 text-right">Inflow/Outflow</th>
                      <th className="py-2.5">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.filter((t) => t.method === 'cash').map((t) => (
                      <tr key={t.id} className="border-b hover:bg-slate-50/50" style={{ borderColor: 'var(--line)' }}>
                        <td className="py-2.5 font-mono text-[11px]">{t.time.split(',')[1] || t.time}</td>
                        <td className="py-2.5">{t.user}</td>
                        <td className="py-2.5 font-bold">{t.action}</td>
                        <td className="py-2.5 text-right font-mono font-bold" style={{ color: t.type === 'inflow' ? 'var(--cardamom-d)' : 'var(--clay)' }}>
                          {t.type === 'inflow' ? '+' : '−'} {formatINR(t.amountPaise)}
                        </td>
                        <td className="py-2.5 text-slate-500 max-w-[200px] truncate">{t.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ── 3. EXPENSE MANAGEMENT TAB ── */}
      {activeTab === 'expenses' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Receipts &amp; Expense Claims</h3>
            <button onClick={() => setActiveModal('record_expense')} className="btn btn-primary text-xs gap-1 px-4">
              ＋ Add Expense Record
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
              <div>
                <span className="text-xs text-slate-400 font-bold">Total Approved Expenses</span>
                <h4 className="text-2xl font-bold font-mono mt-1">{formatINR(totalExpensesPaise)}</h4>
              </div>
              <span className="text-[10px] text-slate-400 mt-2">Deducted from net liquid cash</span>
            </div>
            <div className="card p-4 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
              <div>
                <span className="text-xs text-slate-400 font-bold">Pending Approval</span>
                <h4 className="text-2xl font-bold font-mono mt-1" style={{ color: 'var(--turmeric-d)' }}>
                  {formatINR(expenses.filter((e) => e.status === 'pending').reduce((s, e) => s + e.amountPaise, 0))}
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 mt-2">{expenses.filter((e) => e.status === 'pending').length} records pending review</span>
            </div>
            <div className="card p-4 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
              <div>
                <span className="text-xs text-slate-400 font-bold">Recurring Bill Contracts</span>
                <h4 className="text-2xl font-bold font-mono mt-1">{expenses.filter((e) => e.recurring).length} Active</h4>
              </div>
              <span className="text-[10px] text-slate-400 mt-2">Rent, Internet, Gas etc.</span>
            </div>
          </div>

          <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
            <div className="flex flex-wrap gap-2.5 items-center justify-between mb-3.5">
              <h4 className="font-bold text-sm">Ledger of Business Expenses</h4>
              <div className="flex gap-2">
                <button onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(expenses));
                  const dlAnchor = document.createElement('a');
                  dlAnchor.setAttribute("href",     dataStr);
                  dlAnchor.setAttribute("download", `expenses-${new Date().toLocaleDateString()}.json`);
                  dlAnchor.click();
                }} className="btn btn-sm btn-ghost border text-xs gap-1.5"><Download size={13} /> Export JSON</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}>
                    <th className="py-2.5">Date</th>
                    <th className="py-2.5">Category</th>
                    <th className="py-2.5">Vendor</th>
                    <th className="py-2.5">Payment Method</th>
                    <th className="py-2.5 text-right">Tax (GST)</th>
                    <th className="py-2.5 text-right">Total Amount</th>
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b hover:bg-slate-50/50" style={{ borderColor: 'var(--line)' }}>
                      <td className="py-2.5">{e.date}</td>
                      <td className="py-2.5 font-bold">{e.category}</td>
                      <td className="py-2.5">{e.vendor}</td>
                      <td className="py-2.5 capitalize">{e.method.replace('_', ' ')}</td>
                      <td className="py-2.5 text-right font-mono text-slate-500">{formatINR(e.gstPaise)}</td>
                      <td className="py-2.5 text-right font-mono font-bold">{formatINR(e.amountPaise)}</td>
                      <td className="py-2.5">
                        <span className={`text-[9px] px-2 py-0.5 font-bold rounded-full capitalize ${e.status === 'approved' ? 'bg-green-100 text-green-700' : e.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        {e.status === 'pending' && isOwner && (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => {
                                const next = expenses.map((x) => x.id === e.id ? { ...x, status: 'approved' as const, approvedBy: staff.name } : x);
                                saveExpenses(next);
                                // add transaction
                                const t: FinancialTransaction = {
                                  id: Date.now().toString(),
                                  time: new Date().toLocaleString('en-IN'),
                                  user: staff.name,
                                  action: `Approved ${e.category}`,
                                  amountPaise: e.amountPaise,
                                  type: 'outflow',
                                  method: e.method,
                                  category: e.category,
                                  details: `Approved expense paid to ${e.vendor}`
                                };
                                saveTransactions([t, ...transactions]);
                                showToast('Expense approved!');
                              }}
                              className="btn btn-xs py-0.5 px-2 text-[10px] bg-green-600 text-white font-bold"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                const next = expenses.map((x) => x.id === e.id ? { ...x, status: 'rejected' as const } : x);
                                saveExpenses(next);
                                showToast('Expense rejected.');
                              }}
                              className="btn btn-xs py-0.5 px-2 text-[10px] bg-red-600 text-white font-bold"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {e.status === 'approved' && <span className="text-[10px] text-slate-400 font-bold">Claim settled</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ── 4. VENDOR MANAGEMENT TAB ── */}
      {activeTab === 'vendors' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Vendor Accounts &amp; Ledgers</h3>
            <button onClick={() => setActiveModal('vendor_pay')} className="btn btn-primary text-xs gap-1 px-4">
              ＋ Register Bill Payment
            </button>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* Vendor summary outstanding */}
            <section className="card p-5 col-span-1" style={{ background: 'var(--paper-2)' }}>
              <h4 className="font-bold mb-4">Total Accounts Payable</h4>
              <div className="text-center py-6 border-b" style={{ borderColor: 'var(--line)' }}>
                <span className="text-xs text-slate-400">Total Outstanding vendor debt</span>
                <h3 className="text-3xl font-extrabold font-mono mt-1 text-slate-900">{formatINR(pendingVendorPaymentsPaise)}</h3>
              </div>
              <div className="mt-4 space-y-2">
                {vendorBills.map((b) => (
                  <div key={b.id} className="flex justify-between text-xs py-1 border-b" style={{ borderColor: 'var(--line)' }}>
                    <span>{b.vendorName}</span>
                    <b className="font-mono">{formatINR(b.amountPaise - b.paidAmountPaise)}</b>
                  </div>
                ))}
              </div>
            </section>

            {/* Vendor Bills database list */}
            <section className="card p-5 col-span-2" style={{ background: 'var(--paper-2)' }}>
              <h4 className="font-bold mb-3">Purchase Invoices Received</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}>
                      <th className="py-2.5">Bill Number</th>
                      <th className="py-2.5">Vendor</th>
                      <th className="py-2.5">Invoice Date</th>
                      <th className="py-2.5">Due Date</th>
                      <th className="py-2.5 text-right">Tax (GST)</th>
                      <th className="py-2.5 text-right">Total Amount</th>
                      <th className="py-2.5 text-right">Outstanding</th>
                      <th className="py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorBills.map((b) => (
                      <tr key={b.id} className="border-b hover:bg-slate-50/50" style={{ borderColor: 'var(--line)' }}>
                        <td className="py-2.5 font-bold font-mono">{b.billNumber}</td>
                        <td className="py-2.5 font-bold">{b.vendorName}</td>
                        <td className="py-2.5">{b.date}</td>
                        <td className="py-2.5">{b.dueDate}</td>
                        <td className="py-2.5 text-right font-mono text-slate-500">{formatINR(b.gstPaise)}</td>
                        <td className="py-2.5 text-right font-mono">{formatINR(b.amountPaise)}</td>
                        <td className="py-2.5 text-right font-mono font-bold" style={{ color: b.status !== 'paid' ? 'var(--clay)' : 'inherit' }}>
                          {formatINR(b.amountPaise - b.paidAmountPaise)}
                        </td>
                        <td className="py-2.5">
                          <span className={`text-[9px] px-2 py-0.5 font-bold rounded-full capitalize ${b.status === 'paid' ? 'bg-green-100 text-green-700' : b.status === 'partial' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ── 5. PAYMENT SETTLEMENT TRACKING TAB ── */}
      {activeTab === 'settlements' && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold">Digital Payment Gateway Settlements (Razorpay / Paytm)</h3>
          <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
            <h4 className="font-bold mb-4 flex items-center justify-between">
              <span>Timeline of Settlements (UPI &amp; Card Credit Tracker)</span>
              <span className="text-xs pill text-emerald-800 bg-emerald-100">Automatic T+1 reconciliation active</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}>
                    <th className="py-2.5">Batch Date</th>
                    <th className="py-2.5">Gateway Channel</th>
                    <th className="py-2.5 text-right">Transactions count</th>
                    <th className="py-2.5 text-right">Gross Volume</th>
                    <th className="py-2.5 text-right">Gateway Fees (1.8%)</th>
                    <th className="py-2.5 text-right">Net Payout</th>
                    <th className="py-2.5 text-right">Credit Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { date: 'Yesterday (24 Jul)', ch: 'Razorpay UPI', count: 48, gross: 2450000, fee: 44100, status: 'Credited to HDFC' },
                    { date: 'Yesterday (24 Jul)', ch: 'Razorpay Card', count: 12, gross: 820000, fee: 14760, status: 'Credited to HDFC' },
                    { date: 'Today (25 Jul)', ch: 'Razorpay UPI', count: 22, gross: upiSalesPaise, fee: Math.round(upiSalesPaise * 0.018), status: 'Pending Settlement' },
                    { date: 'Today (25 Jul)', ch: 'Razorpay Card', count: 4, gross: cardSalesPaise, fee: Math.round(cardSalesPaise * 0.018), status: 'Pending Settlement' }
                  ].map((s, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50/50" style={{ borderColor: 'var(--line)' }}>
                      <td className="py-2.5">{s.date}</td>
                      <td className="py-2.5 font-bold">{s.ch}</td>
                      <td className="py-2.5 text-right font-mono">{s.count}</td>
                      <td className="py-2.5 text-right font-mono">{formatINR(s.gross)}</td>
                      <td className="py-2.5 text-right font-mono text-slate-500">{formatINR(s.fee)}</td>
                      <td className="py-2.5 text-right font-mono font-bold">{formatINR(s.gross - s.fee)}</td>
                      <td className="py-2.5 text-right">
                        <span className={`text-[10px] font-bold ${s.status.includes('Credited') ? 'text-emerald-700' : 'text-orange-700'}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ── 6. BANK ACCOUNTS TAB ── */}
      {activeTab === 'banks' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Liquid Bank Balances &amp; reconciliation</h3>
            <div className="flex gap-2">
              <button onClick={() => setActiveModal('transfer')} className="btn btn-sm btn-ghost border text-xs gap-1.5">
                💱 Account Transfer
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {bankAccounts.map((a) => (
              <div key={a.id} className="card p-5 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">{a.name}</h4>
                    <span className="text-[10.5px] font-mono text-slate-400">{a.identifier}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-bold ${a.type === 'bank' ? 'bg-blue-100 text-blue-700' : a.type === 'upi' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                    {a.type}
                  </span>
                </div>
                <div className="mt-6 flex justify-between items-end">
                  <span className="text-xs text-slate-400">Available Liquid Funds</span>
                  <h3 className="text-2xl font-extrabold font-mono">{formatINR(a.balancePaise)}</h3>
                </div>
              </div>
            ))}
          </div>

          <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
            <h4 className="font-bold mb-3">Mock Bank Statement Reconciliation Engine</h4>
            <p className="text-xs text-slate-500 mb-4">Upload your PDF bank statement to automatically compare with sales ledgers and verify deposits.</p>
            <div className="p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--line-2)' }}>
              <span className="text-3xl">📄</span>
              <b className="text-xs">Drag &amp; drop bank statement file (.pdf or .csv)</b>
              <span className="text-[10px] text-slate-400">Or browse files on your device</span>
              <button onClick={() => showToast('Mock Statement uploaded! Automatically matching 24 transactions...')} className="btn btn-primary text-xs mt-3">Browse File</button>
            </div>
          </section>
        </div>
      )}

      {/* ── 7. PAYROLL TAB ── */}
      {activeTab === 'payroll' && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold">Salary ledger &amp; Staff Advances</h3>
          <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
            <h4 className="font-bold mb-3">Active Employees Pay sheet (July 2026)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}>
                    <th className="py-2.5">Employee</th>
                    <th className="py-2.5">Role</th>
                    <th className="py-2.5 text-right">Attendance Days</th>
                    <th className="py-2.5 text-right">Base Salary</th>
                    <th className="py-2.5 text-right">Advances Outstanding</th>
                    <th className="py-2.5 text-right">Bonus / Incentives</th>
                    <th className="py-2.5 text-right">Net Payable</th>
                    <th className="py-2.5">Payout Status</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.map((emp) => {
                    const netPayablePaise = emp.baseSalaryPaise - emp.advancePaise + emp.bonusPaise - emp.deductionPaise;
                    return (
                      <tr key={emp.id} className="border-b hover:bg-slate-50/50" style={{ borderColor: 'var(--line)' }}>
                        <td className="py-2.5 font-bold">{emp.name}</td>
                        <td className="py-2.5">{emp.role}</td>
                        <td className="py-2.5 text-right font-mono font-bold">{emp.attendanceDays} / 26 days</td>
                        <td className="py-2.5 text-right font-mono">{formatINR(emp.baseSalaryPaise)}</td>
                        <td className="py-2.5 text-right font-mono text-amber-700">− {formatINR(emp.advancePaise)}</td>
                        <td className="py-2.5 text-right font-mono text-emerald-700">+{formatINR(emp.bonusPaise)}</td>
                        <td className="py-2.5 text-right font-mono font-bold">{formatINR(netPayablePaise)}</td>
                        <td className="py-2.5">
                          <span className={`text-[9px] px-2 py-0.5 font-bold rounded-full capitalize ${emp.paidStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {emp.paidStatus}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          {emp.paidStatus !== 'paid' && (
                            <button
                              onClick={() => {
                                const next = payroll.map((p) => p.id === emp.id ? { ...p, paidStatus: 'paid' as const } : p);
                                savePayroll(next);

                                // Add expense record
                                const newExpense: Expense = {
                                  id: Date.now().toString(),
                                  date: new Date().toLocaleDateString('en-IN'),
                                  category: 'Salary',
                                  vendor: emp.name,
                                  amountPaise: netPayablePaise,
                                  gstPaise: 0,
                                  method: 'bank_transfer',
                                  status: 'approved',
                                  approvedBy: staff.name,
                                  recurring: false,
                                  notes: `Paid salary for July 2026 to ${emp.name}`
                                };
                                saveExpenses([newExpense, ...expenses]);

                                // Add transaction
                                const newTransaction: FinancialTransaction = {
                                  id: Date.now().toString(),
                                  time: new Date().toLocaleString('en-IN'),
                                  user: staff.name,
                                  action: `Salary Payout: ${emp.name}`,
                                  amountPaise: netPayablePaise,
                                  type: 'outflow',
                                  method: 'bank_transfer',
                                  category: 'Salary',
                                  details: `Salary payout to employee ${emp.name}`
                                };
                                saveTransactions([newTransaction, ...transactions]);

                                showToast(`Salary of ${formatINR(netPayablePaise)} paid to ${emp.name}`);
                              }}
                              className="btn btn-xs py-0.5 px-2 text-[10px] bg-green-600 text-white font-bold"
                            >
                              💸 Pay Out
                            </button>
                          )}
                          {emp.paidStatus === 'paid' && <span className="text-[10px] text-slate-400 font-bold">Settled</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ── 8. ACCOUNTING MODULE TAB ── */}
      {activeTab === 'accounting' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Professional Restaurant Accounting Ledger</h3>
            <button onClick={() => setActiveModal('journal_entry')} className="btn btn-primary text-xs gap-1 px-4">
              ＋ Add Journal Entry
            </button>
          </div>

          <div className="grid lg:grid-cols-[1.5fr_2.5fr] gap-4">
            {/* Chart of Accounts */}
            <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
              <h4 className="font-bold mb-3">Chart of Accounts Tree</h4>
              <div className="space-y-2 text-xs font-bold">
                {[
                  { name: '1000 - Assets (Liquid/Cash accounts)', type: 'group' },
                  { name: '  1100 - Cash Register Drawer', type: 'item', bal: expectedCashInDrawerPaise },
                  { name: '  1200 - HDFC Current Account', type: 'item', bal: 38245000 },
                  { name: '2000 - Liabilities (Creditors)', type: 'group' },
                  { name: '  2100 - Accounts Payable (Vendors)', type: 'item', bal: pendingVendorPaymentsPaise },
                  { name: '3000 - Equity & Retained Earnings', type: 'group' },
                  { name: '4000 - Revenues (Income)', type: 'group' },
                  { name: '  4100 - Sales Revenue (Food & Drink)', type: 'item', bal: totalSalesPaise },
                  { name: '5000 - Cost of Goods Sold (COGS)', type: 'group' },
                  { name: '6000 - Operating Expenses (OPEX)', type: 'group' },
                  { name: '  6100 - Direct Category Expenses', type: 'item', bal: totalExpensesPaise }
                ].map((a, i) => (
                  <div key={i} className={`flex justify-between py-1.5 ${a.type === 'group' ? 'border-b pb-1 font-extrabold text-slate-800' : 'pl-4 font-normal font-mono text-slate-600'}`} style={{ borderColor: 'var(--line)' }}>
                    <span>{a.name}</span>
                    {a.bal !== undefined && <span>{formatINR(a.bal)}</span>}
                  </div>
                ))}
              </div>
            </section>

            {/* Trial Balance & Profit & Loss Mock Sheets */}
            <div className="flex flex-col gap-4">
              {/* Profit & Loss Sheet */}
              <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
                <h4 className="font-bold mb-3 flex items-center justify-between">
                  <span>📊 Profit &amp; Loss Statement</span>
                  <span className="text-xs pill">Today</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between font-bold border-b pb-1.5" style={{ borderColor: 'var(--line)' }}>
                    <span>Gross Revenues (Sales)</span>
                    <span className="font-mono text-emerald-700">+{formatINR(totalSalesPaise)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-b pb-1.5" style={{ borderColor: 'var(--line)' }}>
                    <span>Cost of Goods Sold (COGS - 30% Est)</span>
                    <span className="font-mono text-amber-700">− {formatINR(Math.round(totalSalesPaise * 0.3))}</span>
                  </div>
                  <div className="flex justify-between font-bold border-b pb-1.5" style={{ borderColor: 'var(--line)' }}>
                    <span>Operating Expenses (OPEX)</span>
                    <span className="font-mono text-amber-700">− {formatINR(totalExpensesPaise)}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-sm border-t pt-2" style={{ borderColor: 'var(--line)' }}>
                    <span>Net Operating Profit</span>
                    <span className="font-mono text-emerald-800">{formatINR(Math.max(0, Math.round(totalSalesPaise * 0.7) - totalExpensesPaise))}</span>
                  </div>
                </div>
              </section>

              {/* Recent Journal Entries */}
              <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
                <h4 className="font-bold mb-3">General Ledger Journal Entries</h4>
                <div className="space-y-3">
                  {journalEntries.map((j) => (
                    <div key={j.id} className="p-3 rounded-xl border text-xs" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                      <div className="flex justify-between font-bold mb-1.5">
                        <span>{j.description}</span>
                        <span className="text-[10px] text-slate-400">{j.date}</span>
                      </div>
                      <div className="space-y-1 font-mono text-[11px] text-slate-600">
                        {j.debits.map((d, index) => (
                          <div key={index} className="flex justify-between">
                            <span>Dr. {d.account}</span>
                            <span className="text-emerald-700">{formatINR(d.amountPaise)}</span>
                          </div>
                        ))}
                        {j.credits.map((c, index) => (
                          <div key={index} className="flex justify-between pl-3">
                            <span>Cr. {c.account}</span>
                            <span>{formatINR(c.amountPaise)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. SETTINGS & AUDIT LOGS TAB ── */}
      {activeTab === 'settings' && (
        <div className="flex flex-col gap-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Configuration options */}
            <section className="card p-5 flex flex-col gap-4" style={{ background: 'var(--paper-2)' }}>
              <h4 className="font-bold flex items-center gap-1.5"><Settings size={18} /> Financial Settings &amp; Rules</h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Shift Variance Auto-Approval Limit</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={varianceLimitPaise / 100}
                      onChange={(e) => setVarianceLimitPaise(Number(e.target.value) * 100 || 0)}
                      className="inp w-32"
                    />
                    <span className="text-xs self-center">INR</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Variances above this will freeze daily closing until owner approval is logged.</span>
                </div>

                <div className="pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex justify-between items-center">
                    <div>
                      <b className="text-xs block">Require Manager Expense Approval</b>
                      <span className="text-[10px] text-slate-400">Claims made by cashier staff require owner validation</span>
                    </div>
                    <button
                      onClick={() => setRequireExpenseApproval(!requireExpenseApproval)}
                      className={`relative shrink-0 rounded-full w-11 h-6 transition-colors ${requireExpenseApproval ? 'bg-amber-600' : 'bg-slate-300'}`}
                    >
                      <span className={`absolute top-[3px] left-[3px] rounded-full bg-white w-4 h-4 transition-transform ${requireExpenseApproval ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex justify-between items-center">
                    <div>
                      <b className="text-xs block">Enable Petty Cash Ledger</b>
                      <span className="text-[10px] text-slate-400">Adds Main Register Petty Cash Box balance monitoring</span>
                    </div>
                    <button
                      onClick={() => setPettyCashEnabled(!pettyCashEnabled)}
                      className={`relative shrink-0 rounded-full w-11 h-6 transition-colors ${pettyCashEnabled ? 'bg-amber-600' : 'bg-slate-300'}`}
                    >
                      <span className={`absolute top-[3px] left-[3px] rounded-full bg-white w-4 h-4 transition-transform ${pettyCashEnabled ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Audit Logs */}
            <section className="card p-5" style={{ background: 'var(--paper-2)' }}>
              <h4 className="font-bold mb-3">Audit Logs (Financial Modifications)</h4>
              <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                {auditLogs.map((l) => (
                  <div key={l.id} className="p-3 rounded-xl border text-xs" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                    <div className="flex justify-between font-bold mb-1.5">
                      <span>{l.action} · {l.user}</span>
                      <span className="text-[9.5px] font-mono text-slate-400">{l.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 leading-normal mb-1">{l.details}</p>
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>Old: {l.oldValue}</span>
                      <span>New: {l.newValue}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ── MODALS CONTAINER ── */}
      {activeModal && (
        <div className="scrim anim-fade z-[9900] flex items-center justify-center overflow-y-auto p-4">
          {/* Backdrop click close */}
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setActiveModal(null)} />

          {/* Record Expense Modal */}
          {activeModal === 'record_expense' && (
            <div className="relative card w-full max-w-md p-5 anim-pop z-10" style={{ background: 'var(--paper-2)', borderRadius: 22, boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' }}>
              <div className="flex justify-between items-center mb-4 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
                <h3 className="font-display font-bold text-base flex items-center gap-2">
                  <span>🧾</span> Record Business Expense
                </h3>
                <button onClick={() => setActiveModal(null)} className="btn btn-icon btn-sm btn-ghost"><X size={18} /></button>
              </div>
              <form onSubmit={handleRecordExpense} className="space-y-3.5">
                <div>
                  <label className="lbl">Expense Category</label>
                  <CustomSelect
                    value={expenseForm.category}
                    onChange={(val) => setExpenseForm({ ...expenseForm, category: val })}
                    options={['Raw Materials', 'Kitchen Supplies', 'Utilities', 'Electricity', 'Water', 'Gas', 'Rent', 'Salary', 'Cleaning', 'Internet', 'Maintenance', 'Miscellaneous'].map((c) => ({
                      value: c,
                      label: c
                    }))}
                  />
                </div>
                <div>
                  <label className="lbl">Vendor Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Amul Milk Agency"
                    value={expenseForm.vendor}
                    onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                    className="inp"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="lbl">Amount (INR)</label>
                    <input
                      type="number"
                      required
                      placeholder="500.00"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      className="inp"
                    />
                  </div>
                  <div>
                    <label className="lbl">GST Rate (%)</label>
                    <CustomSelect
                      value={expenseForm.gstRate}
                      onChange={(val) => setExpenseForm({ ...expenseForm, gstRate: val })}
                      options={['0', '5', '12', '18', '28'].map((r) => ({
                        value: r,
                        label: `${r}%`
                      }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="lbl">Payment Method</label>
                  <CustomSelect
                    value={expenseForm.method}
                    onChange={(val) => setExpenseForm({ ...expenseForm, method: val })}
                    options={[
                      { value: 'cash', label: 'Cash (Drawer)' },
                      { value: 'bank_transfer', label: 'HDFC Current Account' }
                    ]}
                  />
                </div>
                <div>
                  <label className="lbl">Notes / Remarks</label>
                  <textarea
                    placeholder="Provide details about the invoice or purchase..."
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                    className="inp h-16"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="recurring"
                    checked={expenseForm.recurring}
                    onChange={(e) => setExpenseForm({ ...expenseForm, recurring: e.target.checked })}
                  />
                  <label htmlFor="recurring" className="text-xs font-bold">This is a recurring monthly bill</label>
                </div>
                <button type="submit" className="btn btn-primary w-full py-2.5">
                  Save &amp; Record Transaction
                </button>
              </form>
            </div>
          )}

          {/* Cash Movement Modal */}
          {activeModal === 'cash_movement' && (
            <div className="relative card w-full max-w-md p-5 anim-pop z-10" style={{ background: 'var(--paper-2)', borderRadius: 22, boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' }}>
              <div className="flex justify-between items-center mb-4 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
                <h3 className="font-display font-bold text-base flex items-center gap-2">
                  <span>🗄️</span> Record Cash Movement (In/Out)
                </h3>
                <button onClick={() => setActiveModal(null)} className="btn btn-icon btn-sm btn-ghost"><X size={18} /></button>
              </div>
              <form onSubmit={handleCashMovement} className="space-y-3.5">
                <div>
                  <label className="lbl">Movement Type</label>
                  <CustomSelect
                    value={cashForm.type}
                    onChange={(val) => setCashForm({ ...cashForm, type: val })}
                    options={[
                      { value: 'deposit', label: 'Deposit Cash (Inflow)' },
                      { value: 'withdrawal', label: 'Withdraw Cash (Outflow)' }
                    ]}
                  />
                </div>
                <div>
                  <label className="lbl">Amount (INR)</label>
                  <input
                    type="number"
                    required
                    placeholder="100.00"
                    value={cashForm.amount}
                    onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                    className="inp"
                  />
                </div>
                <div>
                  <label className="lbl">Description / Notes</label>
                  <textarea
                    placeholder="Details (e.g., deposited safe cash drop, petty cash withdrawal...)"
                    value={cashForm.details}
                    onChange={(e) => setCashForm({ ...cashForm, details: e.target.value })}
                    className="inp h-20"
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full py-2.5">
                  Register Movement
                </button>
              </form>
            </div>
          )}

          {/* Transfer Modal */}
          {activeModal === 'transfer' && (
            <div className="relative card w-full max-w-md p-5 anim-pop z-10" style={{ background: 'var(--paper-2)', borderRadius: 22, boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' }}>
              <div className="flex justify-between items-center mb-4 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
                <h3 className="font-display font-bold text-base">💱 Account Transfer</h3>
                <button onClick={() => setActiveModal(null)} className="btn btn-icon btn-sm btn-ghost"><X size={18} /></button>
              </div>
              <form onSubmit={handleTransfer} className="space-y-3.5">
                <div>
                  <label className="lbl">From Account (Source)</label>
                  <CustomSelect
                    value={transferForm.fromAccountId}
                    onChange={(val) => setTransferForm({ ...transferForm, fromAccountId: val })}
                    placeholder="Select source account..."
                    options={bankAccounts.map((a) => ({
                      value: a.id,
                      label: `${a.name} (${formatINR(a.balancePaise)})`
                    }))}
                  />
                </div>
                <div>
                  <label className="lbl">To Account (Destination)</label>
                  <CustomSelect
                    value={transferForm.toAccountId}
                    onChange={(val) => setTransferForm({ ...transferForm, toAccountId: val })}
                    placeholder="Select destination account..."
                    options={bankAccounts.map((a) => ({
                      value: a.id,
                      label: a.name
                    }))}
                  />
                </div>
                <div>
                  <label className="lbl">Amount (INR)</label>
                  <input
                    type="number"
                    required
                    placeholder="1000.00"
                    value={transferForm.amount}
                    onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                    className="inp"
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full py-2.5">
                  Execute Transfer
                </button>
              </form>
            </div>
          )}

          {/* Pay Vendor Modal */}
          {activeModal === 'vendor_pay' && (
            <div className="relative card w-full max-w-md p-5 anim-pop z-10" style={{ background: 'var(--paper-2)', borderRadius: 22, boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' }}>
              <div className="flex justify-between items-center mb-4 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
                <h3 className="font-display font-bold text-base">🤝 Register Vendor Bill Payment</h3>
                <button onClick={() => setActiveModal(null)} className="btn btn-icon btn-sm btn-ghost"><X size={18} /></button>
              </div>
              <form onSubmit={handlePayVendor} className="space-y-3.5">
                <div>
                  <label className="lbl">Select Outstanding Bill</label>
                  <CustomSelect
                    value={vendorPayForm.billId}
                    onChange={(val) => setVendorPayForm({ ...vendorPayForm, billId: val })}
                    placeholder="Select bill..."
                    options={vendorBills.filter((b) => b.status !== 'paid').map((b) => ({
                      value: b.id,
                      label: `${b.vendorName} - Bill ${b.billNumber} (${formatINR(b.amountPaise - b.paidAmountPaise)} remaining)`
                    }))}
                  />
                </div>
                <div>
                  <label className="lbl">Amount to Pay (INR)</label>
                  <input
                    type="number"
                    required
                    placeholder="500.00"
                    value={vendorPayForm.amount}
                    onChange={(e) => setVendorPayForm({ ...vendorPayForm, amount: e.target.value })}
                    className="inp"
                  />
                </div>
                <div>
                  <label className="lbl">Payment Account Source</label>
                  <CustomSelect
                    value={vendorPayForm.accountId}
                    onChange={(val) => setVendorPayForm({ ...vendorPayForm, accountId: val })}
                    placeholder="Select source account..."
                    options={bankAccounts.map((a) => ({
                      value: a.id,
                      label: `${a.name} (${formatINR(a.balancePaise)})`
                    }))}
                  />
                </div>
                <div>
                  <label className="lbl">Payment Method</label>
                  <CustomSelect
                    value={vendorPayForm.method}
                    onChange={(val) => setVendorPayForm({ ...vendorPayForm, method: val })}
                    options={[
                      { value: 'bank_transfer', label: 'Bank Transfer (IMPS/NEFT)' },
                      { value: 'cash', label: 'Cash (Petty Cash Drawer)' }
                    ]}
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full py-2.5">
                  Submit Payment Record
                </button>
              </form>
            </div>
          )}

          {/* Generate X Report Modal */}
          {activeModal === 'x_report' && (
            <div className="relative card w-full max-w-md p-5 anim-pop z-10" style={{ background: 'var(--paper-2)', borderRadius: 22, boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' }}>
              <div className="flex justify-between items-center mb-4 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
                <h3 className="font-display font-bold text-base flex items-center gap-1.5">
                  <ClipboardList size={18} /> Shift X Report (Mid-day Review)
                </h3>
                <button onClick={() => setActiveModal(null)} className="btn btn-icon btn-sm btn-ghost"><X size={18} /></button>
              </div>
              <div className="space-y-3.5 text-xs">
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="font-bold text-[10.5px] text-amber-800">⚠️ Shift Status: ACTIVE</p>
                  <p className="text-[10px] text-amber-700">This X Report is a mid-shift reading. Current transactions will keep updating expected totals.</p>
                </div>
                <div className="space-y-2 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex justify-between"><span>Today Gross Sales:</span><b className="font-mono">{formatINR(totalSalesPaise)}</b></div>
                  <div className="flex justify-between"><span>Discount Given:</span><b className="font-mono text-amber-700">− {formatINR(245000)}</b></div>
                  <div className="flex justify-between"><span>GST Collected (5%):</span><b className="font-mono text-slate-500">+{formatINR(gstCollectedPaise)}</b></div>
                  <div className="flex justify-between font-bold border-t pt-1" style={{ borderColor: 'var(--line)' }}>
                    <span>Net Receivables Volume:</span>
                    <span className="font-mono">{formatINR(totalSalesPaise + gstCollectedPaise - 245000)}</span>
                  </div>
                </div>
                <div className="space-y-2 border-b pb-3 font-mono" style={{ borderColor: 'var(--line)' }}>
                  <p className="font-sans font-bold text-slate-800">Payment Channel Breakdown</p>
                  <div className="flex justify-between"><span>Cash Expected:</span><span>{formatINR(cashSalesPaise)}</span></div>
                  <div className="flex justify-between"><span>UPI Volume:</span><span>{formatINR(upiSalesPaise)}</span></div>
                  <div className="flex justify-between"><span>Card Volume:</span><span>{formatINR(cardSalesPaise)}</span></div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button onClick={() => showToast('X Report sent to printer...')} className="btn text-xs py-2 px-3">🖨️ Print</button>
                  <button onClick={() => showToast('PDF Report downloaded!')} className="btn text-xs py-2 px-3">📥 PDF</button>
                  <button onClick={() => showToast('X Report emailed to manager!')} className="btn btn-primary text-xs py-2 px-3">✉️ Email</button>
                </div>
              </div>
            </div>
          )}

          {/* Close Shift (Z Report) Modal */}
          {activeModal === 'close_shift' && (
            <div className="relative card w-full max-w-md p-5 anim-pop z-10" style={{ background: 'var(--paper-2)', borderRadius: 22, boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' }}>
              <div className="flex justify-between items-center mb-4 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
                <h3 className="font-display font-bold text-base flex items-center gap-1.5">
                  <ClipboardList size={18} /> Close Shift (Z Report Reconciliation)
                </h3>
                <button onClick={() => setActiveModal(null)} className="btn btn-icon btn-sm btn-ghost"><X size={18} /></button>
              </div>
              <form onSubmit={handleCloseShift} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl" style={{ background: 'var(--paper-3)' }}>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Expected Shift Cash</span>
                    <b className="text-sm font-mono">{formatINR(expectedCashInDrawerPaise)}</b>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Opening Balance</span>
                    <b className="text-sm font-mono">{formatINR(openingBalancePaise)}</b>
                  </div>
                </div>
                <div>
                  <label className="lbl">Counted Actual Cash in Register Drawer (INR)</label>
                  <input
                    type="number"
                    required
                    placeholder="Enter final cash count..."
                    value={cashDrawerActualPaise || ''}
                    onChange={(e) => setCashDrawerActualPaise(parseFloat(e.target.value) || 0)}
                    className="inp font-mono text-base font-bold"
                  />
                </div>
                {cashDrawerActualPaise > 0 && (() => {
                  const actualPaise = Math.round(cashDrawerActualPaise * 100);
                  const diffPaise = actualPaise - expectedCashInDrawerPaise;
                  const absDiff = Math.abs(diffPaise);
                  const isMatch = absDiff <= 100;
                  return (
                    <div className={`p-3 rounded-xl border ${isMatch ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                      <div className="flex justify-between font-bold">
                        <span>Reconciliation Variance:</span>
                        <span className="font-mono">{diffPaise >= 0 ? '+' : '−'} {formatINR(absDiff)}</span>
                      </div>
                      <p className="text-[10px] mt-1 leading-normal">
                        {isMatch
                          ? 'Cash counts reconcile successfully with expected totals.'
                          : `WARNING: Cash variance exceeds safe buffer limit! Managers must review this difference.`}
                      </p>
                    </div>
                  );
                })()}
                <div>
                  <label className="lbl">Shift Remarks / Variance Notes</label>
                  <textarea
                    placeholder="Provide details about any cash counts, notes, vouchers or adjustments..."
                    value={varianceRemark}
                    onChange={(e) => setVarianceRemark(e.target.value)}
                    className="inp h-16"
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full py-2.5">
                  🔐 Lock Shift &amp; Generate Z Report
                </button>
              </form>
            </div>
          )}

          {/* Journal Entry Modal */}
          {activeModal === 'journal_entry' && (
            <div className="relative card w-full max-w-md p-5 anim-pop z-10" style={{ background: 'var(--paper-2)', borderRadius: 22, boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' }}>
              <div className="flex justify-between items-center mb-4 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
                <h3 className="font-display font-bold text-base">📓 New General Ledger Journal Entry</h3>
                <button onClick={() => setActiveModal(null)} className="btn btn-icon btn-sm btn-ghost"><X size={18} /></button>
              </div>
              <form onSubmit={handleAddJournal} className="space-y-3.5">
                <div>
                  <label className="lbl">Journal Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Monthly Rent Adjustment"
                    value={journalForm.description}
                    onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })}
                    className="inp"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="lbl">Debit Account</label>
                    <CustomSelect
                      value={journalForm.debitAcc}
                      onChange={(val) => setJournalForm({ ...journalForm, debitAcc: val })}
                      options={['Cash Account', 'HDFC Current Account', 'Vendor Payable', 'Raw Material Expense', 'General OPEX'].map((a) => ({
                        value: a,
                        label: a
                      }))}
                    />
                  </div>
                  <div>
                    <label className="lbl">Debit Amount (INR)</label>
                    <input
                      type="number"
                      required
                      placeholder="100.00"
                      value={journalForm.debitAmt}
                      onChange={(e) => setJournalForm({ ...journalForm, debitAmt: e.target.value })}
                      className="inp"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="lbl">Credit Account</label>
                    <CustomSelect
                      value={journalForm.creditAcc}
                      onChange={(val) => setJournalForm({ ...journalForm, creditAcc: val })}
                      options={['Sales Revenue', 'Cash Account', 'HDFC Current Account', 'Accrued liabilities'].map((a) => ({
                        value: a,
                        label: a
                      }))}
                    />
                  </div>
                  <div>
                    <label className="lbl">Credit Amount (INR)</label>
                    <input
                      type="number"
                      required
                      placeholder="100.00"
                      value={journalForm.debitAmt} // Credit amount matches Debit amount for balanced ledger entry
                      disabled
                      className="inp bg-slate-100 cursor-not-allowed"
                    />
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border text-[10px] text-slate-500 text-center">
                  ✔️ Debit and credit accounts balanced automatically.
                </div>
                <button type="submit" className="btn btn-primary w-full py-2.5">
                  Post Journal Entry
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
