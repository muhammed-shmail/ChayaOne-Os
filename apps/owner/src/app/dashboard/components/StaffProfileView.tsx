'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { formatINR } from '@cafeos/core';
import type { StaffRole } from '@cafeos/db';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ALL_ROLES, PERMISSION_MODULES, PRESETS, resolvePrimaryRole } from '@/lib/rbac';
import { type WaiterStation, formatStationBadge } from '@/lib/waiter-stations';

interface StaffProfileViewProps {
  staff: any;
  onBack: () => void;
  onUpdateStaff: (updated: any) => void;
  onToggleStatus: (staff: any) => void;
  initialTab?: 'overview' | 'attendance' | 'shifts' | 'permissions' | 'security' | 'audit';
  waiterStations: WaiterStation[];
  customRoles: { id: string; name: string; baseRole?: string }[];
  refresh: () => void;
}

export default function StaffProfileView({
  staff,
  onBack,
  onUpdateStaff,
  onToggleStatus,
  initialTab = 'overview',
  waiterStations,
  customRoles,
  refresh,
}: StaffProfileViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'shifts' | 'permissions' | 'security' | 'audit'>(initialTab);

  // Synchronize initialTab if changed from parent
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // ─────────────────────────────────────────────────────────────
  // ATTENDANCE STATE
  // ─────────────────────────────────────────────────────────────
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState<{
    records: any[];
    summary: {
      present: number;
      absent: number;
      late: number;
      halfDay: number;
      leave: number;
      offDay: number;
      working: number;
      missingCheckout: number;
      totalWorkingDays: number;
      attendanceRate: string;
      totalHours: string;
    };
    shifts: any[];
    timezone: string;
  } | null>(null);

  // Attendance filters
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [statusFilter, setStatusFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [attendanceViewMode, setAttendanceViewMode] = useState<'table' | 'calendar'>('table');
  const [selectedDateDetail, setSelectedDateDetail] = useState<any | null>(null);

  // Attendance Modals
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [markForm, setMarkForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    status: 'present',
    clockIn: '09:30 AM',
    clockOut: '05:30 PM',
    notes: '',
  });

  const [showCorrectModal, setShowCorrectModal] = useState(false);
  const [correctForm, setCorrectForm] = useState({
    id: '',
    date: new Date().toISOString().slice(0, 10),
    clockIn: '09:30 AM',
    clockOut: '05:30 PM',
    status: 'present',
    reason: '',
    notes: '',
  });

  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [attendanceActionMsg, setAttendanceActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Fetch Attendance Records
  const loadAttendance = useCallback(async () => {
    if (!staff?.id) return;
    setAttendanceLoading(true);
    try {
      let url = `/api/attendance?staffId=${encodeURIComponent(staff.id)}&view=history`;
      if (customStartDate && customEndDate) {
        url += `&startDate=${encodeURIComponent(customStartDate)}&endDate=${encodeURIComponent(customEndDate)}`;
      } else {
        url += `&month=${encodeURIComponent(selectedMonth)}`;
      }
      if (statusFilter !== 'all') {
        url += `&filterStatus=${encodeURIComponent(statusFilter)}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setAttendanceData(json);
      }
    } catch (err) {
      console.error('Error loading attendance for staff:', err);
    } finally {
      setAttendanceLoading(false);
    }
  }, [staff?.id, selectedMonth, customStartDate, customEndDate, statusFilter]);

  useEffect(() => {
    if (activeTab === 'attendance' || activeTab === 'overview') {
      loadAttendance();
    }
  }, [activeTab, loadAttendance]);

  // Handle Mark Attendance
  const handleMarkAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAttendance(true);
    setAttendanceActionMsg(null);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_status',
          staffId: staff.id,
          date: markForm.date,
          status: markForm.status,
          clockIn: markForm.status === 'absent' || markForm.status === 'leave' || markForm.status === 'off_day' ? null : markForm.clockIn,
          clockOut: markForm.status === 'absent' || markForm.status === 'leave' || markForm.status === 'off_day' ? null : markForm.clockOut,
          notes: markForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAttendanceActionMsg({ type: 'err', text: data.message || 'Failed to mark attendance' });
      } else {
        setAttendanceActionMsg({ type: 'ok', text: `Attendance for ${markForm.date} marked as ${markForm.status.toUpperCase()}` });
        setShowMarkModal(false);
        loadAttendance();
        refresh();
      }
    } catch {
      setAttendanceActionMsg({ type: 'err', text: 'Network error occurred while saving attendance' });
    } finally {
      setIsSavingAttendance(false);
    }
  };

  // Handle Correct Attendance
  const handleCorrectAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctForm.reason.trim()) {
      setAttendanceActionMsg({ type: 'err', text: 'Reason for attendance correction is required for audit logs.' });
      return;
    }
    setIsSavingAttendance(true);
    setAttendanceActionMsg(null);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'correct',
          id: correctForm.id || undefined,
          staffId: staff.id,
          date: correctForm.date,
          clockIn: correctForm.clockIn,
          clockOut: correctForm.clockOut,
          status: correctForm.status,
          reason: correctForm.reason,
          notes: correctForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAttendanceActionMsg({ type: 'err', text: data.message || 'Failed to correct attendance' });
      } else {
        setAttendanceActionMsg({ type: 'ok', text: 'Attendance record updated and logged to audit trail.' });
        setShowCorrectModal(false);
        loadAttendance();
        refresh();
      }
    } catch {
      setAttendanceActionMsg({ type: 'err', text: 'Network error occurred while correcting attendance' });
    } finally {
      setIsSavingAttendance(false);
    }
  };

  // Open correction modal prefilled
  const openCorrectionForRecord = (record: any) => {
    setCorrectForm({
      id: record.id,
      date: record.date,
      clockIn: record.checkIn !== '--' ? record.checkIn : '09:30 AM',
      clockOut: record.checkOut !== '--' ? record.checkOut : '05:30 PM',
      status: record.status || 'present',
      reason: '',
      notes: record.notes || '',
    });
    setShowCorrectModal(true);
  };

  // Quick punch clock in / clock out for staff
  const handleQuickPunch = async (punchAction: 'in' | 'out') => {
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: punchAction, staffId: staff.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setAttendanceActionMsg({ type: 'ok', text: `Staff ${punchAction === 'in' ? 'Clocked In' : 'Clocked Out'} successfully.` });
        loadAttendance();
        refresh();
      } else {
        setAttendanceActionMsg({ type: 'err', text: data.message || 'Punch failed' });
      }
    } catch {
      setAttendanceActionMsg({ type: 'err', text: 'Network error performing punch' });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SHIFTS STATE
  // ─────────────────────────────────────────────────────────────
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    start: '09:00',
    end: '17:00',
    role: staff.role || 'waiter',
  });
  const [isSavingShift, setIsSavingShift] = useState(false);

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingShift(true);
    try {
      const startsAt = `${shiftForm.date}T${shiftForm.start}:00`;
      const endsAt = `${shiftForm.date}T${shiftForm.end}:00`;
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'shift_add',
          staffId: staff.id,
          startsAt,
          endsAt,
          role: shiftForm.role,
        }),
      });
      if (res.ok) {
        setShowAddShiftModal(false);
        loadAttendance();
        refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingShift(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SECURITY & PASSWORD STATE
  // ─────────────────────────────────────────────────────────────
  const [showChangePwModal, setShowChangePwModal] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const [showResetPwModal, setShowResetPwModal] = useState(false);
  const [adminResetNew, setAdminResetNew] = useState('');
  const [adminResetConfirm, setAdminResetConfirm] = useState('');
  const [adminResetError, setAdminResetError] = useState<string | null>(null);
  const [adminResetSuccess, setAdminResetSuccess] = useState<string | null>(null);
  const [adminResetLoading, setAdminResetLoading] = useState(false);

  // Quick PIN update state
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (pwNew.length < 6) {
      setPwError('New password must be at least 6 characters long.');
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError('New password and confirmation do not match.');
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          id: staff.id,
          currentPassword: pwCurrent,
          newPassword: pwNew,
          confirmPassword: pwConfirm,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPwError(json.message || 'Failed to update password');
      } else {
        setPwSuccess('Password updated successfully.');
        setPwCurrent('');
        setPwNew('');
        setPwConfirm('');
        setTimeout(() => setShowChangePwModal(false), 1500);
      }
    } catch {
      setPwError('Network error while updating password');
    } finally {
      setPwLoading(false);
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminResetError(null);
    setAdminResetSuccess(null);

    if (adminResetNew.length < 6) {
      setAdminResetError('New password must be at least 6 characters long.');
      return;
    }
    if (adminResetNew !== adminResetConfirm) {
      setAdminResetError('New password and confirmation do not match.');
      return;
    }

    setAdminResetLoading(true);
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          id: staff.id,
          newPassword: adminResetNew,
          confirmPassword: adminResetConfirm,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAdminResetError(json.message || 'Failed to reset password');
      } else {
        setAdminResetSuccess(`Password for ${staff.name} reset successfully.`);
        setAdminResetNew('');
        setAdminResetConfirm('');
        setTimeout(() => setShowResetPwModal(false), 1500);
      }
    } catch {
      setAdminResetError('Network error while resetting password');
    } finally {
      setAdminResetLoading(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg(null);
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinMsg({ type: 'err', text: 'PIN must be exactly 4 to 6 numeric digits.' });
      return;
    }
    setPinLoading(true);
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setpin', id: staff.id, pin: newPin }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPinMsg({ type: 'err', text: json.error === 'pin_in_use' ? 'This PIN is already assigned to another staff member.' : 'Failed to update PIN.' });
      } else {
        setPinMsg({ type: 'ok', text: 'POS Quick Access PIN updated successfully.' });
        setNewPin('');
        refresh();
      }
    } catch {
      setPinMsg({ type: 'err', text: 'Network error updating PIN' });
    } finally {
      setPinLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // AUDIT LOGS STATE
  // ─────────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const loadAuditLogs = useCallback(async () => {
    if (!staff?.id) return;
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/dashboard/audit?staffId=${encodeURIComponent(staff.id)}`);
      if (res.ok) {
        const json = await res.json();
        setAuditLogs(json.entries || []);
      }
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  }, [staff?.id]);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab, loadAuditLogs]);

  // ─────────────────────────────────────────────────────────────
  // EDIT STAFF PROFILE MODAL STATE
  // ─────────────────────────────────────────────────────────────
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(staff.name || '');
  const [editPhone, setEditPhone] = useState(staff.phone || '');
  const [editEmail, setEditEmail] = useState(staff.email || '');
  const [editUsername, setEditUsername] = useState(staff.username || '');
  const [editCode, setEditCode] = useState(staff.employeeCode || '');
  const [editDesignation, setEditDesignation] = useState(staff.permissions?.designation || '');
  const [editJoiningDate, setEditJoiningDate] = useState(staff.permissions?.joiningDate || '');
  const [editBranch, setEditBranch] = useState(staff.branchAccess?.[0] || 'main-branch');
  const [editPayType, setEditPayType] = useState<string>(staff.payType || '');
  const [editPayRate, setEditPayRate] = useState<string>(staff.payRatePaise ? String(staff.payRatePaise / 100) : '');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: staff.id,
          name: editName,
          phone: editPhone,
          email: editEmail,
          username: editUsername,
          employeeCode: editCode,
          designation: editDesignation,
          joiningDate: editJoiningDate,
          branchAccess: [editBranch],
          payType: editPayType || null,
          payRatePaise: editPayRate ? Math.round(Number(editPayRate) * 100) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.message || 'Failed to update staff profile');
      } else {
        setShowEditModal(false);
        onUpdateStaff(data.member);
        refresh();
      }
    } catch {
      setEditError('Network error saving profile changes');
    } finally {
      setEditSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // CALENDAR GENERATION HELPER
  // ─────────────────────────────────────────────────────────────
  const calendarGrid = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr) || new Date().getFullYear();
    const month = Number(monthStr) || new Date().getMonth() + 1;

    // Total days in month
    const daysInMonth = new Date(year, month, 0).getDate();
    // First day weekday (0 = Sun, 1 = Mon ... 6 = Sat)
    const firstDayWeekday = new Date(year, month - 1, 1).getDay();
    // Shift so Monday is index 0
    const startOffset = (firstDayWeekday + 6) % 7;

    const days: { dateStr: string; dayNum: number; record: any | null }[] = [];

    // Preceding empty slots
    for (let i = 0; i < startOffset; i++) {
      days.push({ dateStr: '', dayNum: 0, record: null });
    }

    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const rec = (attendanceData?.records || []).find((r: any) => r.date === dStr) || null;
      days.push({ dateStr: dStr, dayNum: d, record: rec });
    }

    return days;
  }, [selectedMonth, attendanceData?.records]);

  // Role Badge Styling Helper
  const getRoleBadgeStyle = (r: string) => {
    switch (r) {
      case 'owner':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'manager':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'cashier':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'waiter':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
      case 'kitchen':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30';
      case 'accountant':
        return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30';
      default:
        return 'bg-paper-3 text-ink-2 border-line';
    }
  };

  // Status Badge Styling Helper
  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'working':
        return 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/40 animate-pulse';
      case 'late':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'half_day':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'leave':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
      case 'absent':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
      case 'off_day':
      case 'holiday':
        return 'bg-paper-3 text-ink-3 border-line';
      case 'missing_checkout':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      default:
        return 'bg-paper-3 text-ink-3 border-line';
    }
  };

  return (
    <div className="space-y-4">
      {/* ─────────────────────────────────────────────────────────────
          TOP BAR & PROFILE HEADER CARD
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line bg-paper-2 hover:bg-paper-3 text-xs font-semibold text-ink transition-all cursor-pointer"
        >
          <span>←</span>
          <span>Back to Staff Directory</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-3 font-mono">
            Employee Code: <b className="text-ink">{staff.employeeCode || '—'}</b>
          </span>
        </div>
      </div>

      {/* Main Staff Header Banner */}
      <div className="card p-5" style={{ background: 'var(--paper-1)' }}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <span
              className="grid place-items-center w-16 h-16 rounded-2xl text-2xl font-bold font-mono shrink-0 shadow-sm border border-line/40"
              style={{ background: 'var(--turmeric-l)', color: '#2A1607' }}
            >
              {staff.name.slice(0, 2).toUpperCase()}
            </span>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-ink tracking-tight">{staff.name}</h2>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border capitalize ${getRoleBadgeStyle(staff.role)}`}>
                  {ROLE_LABELS[staff.role as StaffRole] || staff.role}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-paper-2 border border-line">
                  <span className={`w-2 h-2 rounded-full ${staff.active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-ink-2">{staff.active ? 'Active' : 'Suspended'}</span>
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-ink-3 mt-1.5 flex-wrap">
                <span>📍 {staff.branchAccess?.map((b: string) => b.replace('-branch', ' ')).join(', ') || 'Main Branch'}</span>
                {staff.phone && <span>📞 {staff.phone}</span>}
                {staff.email && <span>✉️ {staff.email}</span>}
                {staff.permissions?.designation && (
                  <span className="bg-paper-3 px-2 py-0.5 rounded text-[11px] font-medium text-ink-2">
                    {staff.permissions.designation}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Header Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="px-3 py-1.5 rounded-lg border border-line bg-paper-2 hover:bg-paper-3 text-xs font-semibold text-ink transition-all flex items-center gap-1.5"
            >
              ✏️ <span>Edit Staff</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'attendance'
                  ? 'bg-turmeric text-[#2A1607] font-bold shadow-sm'
                  : 'border border-line bg-paper-2 hover:bg-paper-3 text-ink'
              }`}
            >
              ⏱️ <span>Attendance</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('permissions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'permissions'
                  ? 'bg-turmeric text-[#2A1607] font-bold shadow-sm'
                  : 'border border-line bg-paper-2 hover:bg-paper-3 text-ink'
              }`}
            >
              🔑 <span>Permissions</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'security'
                  ? 'bg-turmeric text-[#2A1607] font-bold shadow-sm'
                  : 'border border-line bg-paper-2 hover:bg-paper-3 text-ink'
              }`}
            >
              🛡️ <span>Account & Security</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleStatus(staff)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                staff.active
                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/30'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
              }`}
            >
              {staff.active ? 'Suspend' : 'Activate'}
            </button>
          </div>
        </div>

        {/* Profile Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto border-t border-line mt-5 pt-3 no-scrollbar">
          {[
            { key: 'overview', label: 'Overview', icon: '👤' },
            { key: 'attendance', label: 'Attendance', icon: '⏱️' },
            { key: 'shifts', label: 'Shifts', icon: '📅' },
            { key: 'permissions', label: 'Permissions', icon: '🔑' },
            { key: 'security', label: 'Account & Security', icon: '🛡️' },
            { key: 'audit', label: 'Audit Logs', icon: '📜' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === t.key
                  ? 'bg-turmeric text-[#2A1607] shadow-sm'
                  : 'text-ink-2 hover:bg-paper-2 hover:text-ink'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: OVERVIEW
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-150">
          {/* Contact Information */}
          <div className="card p-5 space-y-4" style={{ background: 'var(--paper-1)' }}>
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
                <span>📞</span> Contact Information
              </h4>
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="text-[11px] text-turmeric font-semibold hover:underline cursor-pointer"
              >
                Edit
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-line/40">
                <span className="text-ink-3">Phone Number</span>
                <span className="font-mono font-medium text-ink">{staff.phone || 'Not provided'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-line/40">
                <span className="text-ink-3">Email Address</span>
                <span className="font-mono font-medium text-ink">{staff.email || 'Not provided'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-line/40">
                <span className="text-ink-3">Login Username</span>
                <span className="font-mono font-semibold text-turmeric">{staff.username || 'No login ID'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-line/40">
                <span className="text-ink-3">Primary Branch</span>
                <span className="capitalize font-medium text-ink">
                  {staff.branchAccess?.map((b: string) => b.replace('-branch', ' ')).join(', ') || 'Main Branch'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-ink-3">Designation / Role</span>
                <span className="font-medium text-ink">
                  {staff.permissions?.designation || ROLE_LABELS[staff.role as StaffRole] || staff.role}
                </span>
              </div>
            </div>
          </div>

          {/* Employment & Work Profile */}
          <div className="card p-5 space-y-4" style={{ background: 'var(--paper-1)' }}>
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
                <span>💼</span> Employment & Shift Details
              </h4>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-line/40">
                <span className="text-ink-3">System Role</span>
                <span className="font-semibold capitalize text-ink">
                  {ROLE_LABELS[staff.role as StaffRole] || staff.role}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-line/40">
                <span className="text-ink-3">Account Status</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  staff.active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                }`}>
                  {staff.active ? 'Active' : 'Suspended'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-line/40">
                <span className="text-ink-3">Current Shift</span>
                <span className="font-medium text-ink">
                  {staff.currentShift || (staff.active ? 'Active on Floor' : 'Off Shift')}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-line/40">
                <span className="text-ink-3">Joining Date</span>
                <span className="font-mono text-ink">
                  {staff.permissions?.joiningDate || (staff.createdAt ? new Date(staff.createdAt).toLocaleDateString('en-IN') : '—')}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-ink-3">Compensation</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {staff.payType && staff.payRatePaise
                    ? `${formatINR(staff.payRatePaise)} / ${staff.payType === 'monthly' ? 'mo' : 'hr'}`
                    : 'Not configured'}
                </span>
              </div>
            </div>
          </div>

          {/* Attendance & Activity Highlights */}
          <div className="card p-5 space-y-4" style={{ background: 'var(--paper-1)' }}>
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
                <span>📊</span> Monthly Activity Glance
              </h4>
              <button
                type="button"
                onClick={() => setActiveTab('attendance')}
                className="text-[11px] text-turmeric font-semibold hover:underline cursor-pointer"
              >
                View Full Logs →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 rounded-xl bg-paper-2 border border-line">
                <span className="block text-[10px] text-ink-3 uppercase font-bold">Attendance Rate</span>
                <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {attendanceData?.summary?.attendanceRate || '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-paper-2 border border-line">
                <span className="block text-[10px] text-ink-3 uppercase font-bold">Present Days</span>
                <span className="text-xl font-bold font-mono text-ink">
                  {attendanceData?.summary?.present ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-paper-2 border border-line">
                <span className="block text-[10px] text-ink-3 uppercase font-bold">Hours Worked</span>
                <span className="text-lg font-bold font-mono text-ink">
                  {attendanceData?.summary?.totalHours || '0h 00m'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-paper-2 border border-line">
                <span className="block text-[10px] text-ink-3 uppercase font-bold">Late Arrivals</span>
                <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                  {attendanceData?.summary?.late ?? 0}
                </span>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowMarkModal(true)}
                className="w-full py-2 rounded-xl bg-turmeric text-[#2A1607] text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                + Mark Attendance For Today
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: ATTENDANCE (FIRST CLASS FEATURE)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'attendance' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Action Feedback Banner */}
          {attendanceActionMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex justify-between items-center ${
                attendanceActionMsg.type === 'ok'
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                  : 'bg-red-500/10 text-red-600 border border-red-500/30'
              }`}
            >
              <span>{attendanceActionMsg.text}</span>
              <button type="button" onClick={() => setAttendanceActionMsg(null)} className="font-bold cursor-pointer">
                ✕
              </button>
            </div>
          )}

          {/* Attendance KPI Summary Dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="card p-3.5 text-center" style={{ background: 'var(--paper-1)' }}>
              <span className="block text-[10px] font-bold text-ink-3 uppercase tracking-wide">Present</span>
              <span className="block text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {attendanceData?.summary?.present ?? 0}
              </span>
            </div>
            <div className="card p-3.5 text-center" style={{ background: 'var(--paper-1)' }}>
              <span className="block text-[10px] font-bold text-ink-3 uppercase tracking-wide">Absent</span>
              <span className="block text-2xl font-bold font-mono text-red-600 dark:text-red-400 mt-1">
                {attendanceData?.summary?.absent ?? 0}
              </span>
            </div>
            <div className="card p-3.5 text-center" style={{ background: 'var(--paper-1)' }}>
              <span className="block text-[10px] font-bold text-ink-3 uppercase tracking-wide">Late</span>
              <span className="block text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                {attendanceData?.summary?.late ?? 0}
              </span>
            </div>
            <div className="card p-3.5 text-center" style={{ background: 'var(--paper-1)' }}>
              <span className="block text-[10px] font-bold text-ink-3 uppercase tracking-wide">Half Day</span>
              <span className="block text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
                {attendanceData?.summary?.halfDay ?? 0}
              </span>
            </div>
            <div className="card p-3.5 text-center" style={{ background: 'var(--paper-1)' }}>
              <span className="block text-[10px] font-bold text-ink-3 uppercase tracking-wide">Leave</span>
              <span className="block text-2xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
                {attendanceData?.summary?.leave ?? 0}
              </span>
            </div>
            <div className="card p-3.5 text-center" style={{ background: 'var(--paper-1)' }}>
              <span className="block text-[10px] font-bold text-ink-3 uppercase tracking-wide">Working Days</span>
              <span className="block text-2xl font-bold font-mono text-ink mt-1">
                {attendanceData?.summary?.totalWorkingDays ?? 0}
              </span>
            </div>
            <div className="card p-3.5 text-center col-span-2 sm:col-span-1" style={{ background: 'var(--paper-1)' }}>
              <span className="block text-[10px] font-bold text-ink-3 uppercase tracking-wide">Attendance Rate</span>
              <span className="block text-2xl font-bold font-mono text-turmeric mt-1">
                {attendanceData?.summary?.attendanceRate || '0%'}
              </span>
            </div>
          </div>

          {/* Attendance Filter & Action Toolbar */}
          <div className="card p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3" style={{ background: 'var(--paper-1)' }}>
            <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
              {/* Month Selector */}
              <div>
                <label className="block text-[10px] font-bold text-ink-3 uppercase mb-0.5">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-paper-2 border border-line text-xs font-semibold text-ink focus:outline-none focus:border-turmeric cursor-pointer"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((offset) => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - offset);
                    const val = d.toISOString().slice(0, 7);
                    const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
                    return (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[10px] font-bold text-ink-3 uppercase mb-0.5">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-paper-2 border border-line text-xs font-semibold text-ink focus:outline-none focus:border-turmeric cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present Only</option>
                  <option value="absent">Absent Only</option>
                  <option value="late">Late Only</option>
                  <option value="half_day">Half Day Only</option>
                  <option value="leave">Leave Only</option>
                  <option value="working">Currently Working</option>
                  <option value="missing_checkout">Missing Checkout</option>
                </select>
              </div>

              {/* View Toggle Button */}
              <div className="self-end">
                <button
                  type="button"
                  onClick={() => setAttendanceViewMode(attendanceViewMode === 'table' ? 'calendar' : 'table')}
                  className="px-3 py-1.5 rounded-lg bg-paper-2 hover:bg-paper-3 border border-line text-xs font-semibold text-ink flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>{attendanceViewMode === 'table' ? '📅 Switch to Calendar View' : '📋 Switch to Table View'}</span>
                </button>
              </div>
            </div>

            {/* Attendance Action Buttons */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={() => handleQuickPunch('in')}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                title="Immediate clock in for staff"
              >
                ⚡ Clock In
              </button>
              <button
                type="button"
                onClick={() => handleQuickPunch('out')}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                title="Immediate clock out for staff"
              >
                🏁 Clock Out
              </button>
              <button
                type="button"
                onClick={() => setShowMarkModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-turmeric text-[#2A1607] text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>+</span>
                <span>Mark Attendance</span>
              </button>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              CALENDAR VIEW
          ───────────────────────────────────────────────────────── */}
          {attendanceViewMode === 'calendar' && (
            <div className="card p-5 space-y-4" style={{ background: 'var(--paper-1)' }}>
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-ink">
                  Monthly Calendar — {new Date(`${selectedMonth}-01`).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                </h4>
                <span className="text-xs text-ink-3">Click on any date to inspect or correct attendance</span>
              </div>

              {/* Day header row */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-ink-3 pb-1 border-b border-line">
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
                <div>Sun</div>
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-2">
                {calendarGrid.map((day, idx) => {
                  if (!day.dateStr) {
                    return <div key={`empty-${idx}`} className="h-24 rounded-xl bg-paper-2/40 border border-transparent" />;
                  }

                  const rec = day.record;
                  const isToday = day.dateStr === new Date().toISOString().slice(0, 10);
                  const isSelected = selectedDateDetail?.date === day.dateStr;

                  return (
                    <div
                      key={day.dateStr}
                      onClick={() => setSelectedDateDetail(rec || { date: day.dateStr, status: 'no_record', checkIn: '--', checkOut: '--' })}
                      className={`h-24 p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-turmeric bg-turmeric-l/10 shadow-sm'
                          : isToday
                          ? 'border-turmeric/60 bg-paper-2'
                          : 'border-line/70 bg-paper-2/70 hover:bg-paper-2'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-bold font-mono ${isToday ? 'text-turmeric' : 'text-ink'}`}>
                          {day.dayNum}
                        </span>
                        {isToday && <span className="text-[9px] font-bold text-turmeric uppercase">Today</span>}
                      </div>

                      {rec ? (
                        <div className="space-y-1">
                          <span className={`block text-[10px] px-1.5 py-0.5 rounded font-bold uppercase truncate text-center ${getStatusBadgeStyle(rec.status)}`}>
                            {rec.status.replace('_', ' ')}
                          </span>
                          <span className="block text-[9px] font-mono text-ink-3 truncate text-center">
                            {rec.checkIn !== '--' ? rec.checkIn : ''} {rec.workingHours !== '--' ? `(${rec.workingHours})` : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-ink-3/60 italic text-center block">
                          No record
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Selected Date Detail Drawer / Popup Card */}
              {selectedDateDetail && (
                <div className="p-4 rounded-xl border border-turmeric/40 bg-turmeric-l/5 space-y-3 mt-4 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center border-b border-line/50 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-ink">Date Details: {selectedDateDetail.date}</span>
                      {selectedDateDetail.status && (
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${getStatusBadgeStyle(selectedDateDetail.status)}`}>
                          {selectedDateDetail.status.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDateDetail(null)}
                      className="text-ink-3 hover:text-ink text-xs cursor-pointer"
                    >
                      ✕ Close
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="block text-ink-3 text-[10px] uppercase font-bold">Check-in</span>
                      <span className="font-mono font-medium text-ink">{selectedDateDetail.checkIn || '--'}</span>
                    </div>
                    <div>
                      <span className="block text-ink-3 text-[10px] uppercase font-bold">Check-out</span>
                      <span className="font-mono font-medium text-ink">{selectedDateDetail.checkOut || '--'}</span>
                    </div>
                    <div>
                      <span className="block text-ink-3 text-[10px] uppercase font-bold">Working Duration</span>
                      <span className="font-mono font-medium text-ink">{selectedDateDetail.workingHours || '--'}</span>
                    </div>
                    <div>
                      <span className="block text-ink-3 text-[10px] uppercase font-bold">Shift Assigned</span>
                      <span className="font-medium text-ink">{selectedDateDetail.shift || 'General / Unscheduled'}</span>
                    </div>
                  </div>

                  {selectedDateDetail.notes && (
                    <div className="text-xs p-2 rounded bg-paper-2 border border-line">
                      <span className="font-bold text-ink-2">Notes: </span>
                      <span className="text-ink-3">{selectedDateDetail.notes}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => openCorrectionForRecord(selectedDateDetail)}
                      className="px-3 py-1.5 rounded-lg bg-turmeric text-[#2A1607] font-bold text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                    >
                      ✏️ Correct Attendance
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              TABLE HISTORY VIEW
          ───────────────────────────────────────────────────────── */}
          {attendanceViewMode === 'table' && (
            <div className="card overflow-hidden" style={{ background: 'var(--paper-1)' }}>
              {attendanceLoading ? (
                <div className="p-8 text-center text-xs text-ink-3">Loading attendance history records…</div>
              ) : !attendanceData?.records || attendanceData.records.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="text-3xl">⏱️</div>
                  <h4 className="text-base font-bold text-ink">No attendance records yet</h4>
                  <p className="text-xs text-ink-3 max-w-md mx-auto">
                    Start recording attendance through staff check-in/check-out system or record a manual attendance entry using the button above.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowMarkModal(true)}
                    className="px-4 py-2 rounded-xl bg-turmeric text-[#2A1607] text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
                  >
                    + Record First Attendance
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--paper-2)' }}>
                        <th className="p-3.5 text-left font-semibold uppercase tracking-wider text-ink-3">Date</th>
                        <th className="p-3.5 text-left font-semibold uppercase tracking-wider text-ink-3">Day</th>
                        <th className="p-3.5 text-left font-semibold uppercase tracking-wider text-ink-3">Check In</th>
                        <th className="p-3.5 text-left font-semibold uppercase tracking-wider text-ink-3">Check Out</th>
                        <th className="p-3.5 text-left font-semibold uppercase tracking-wider text-ink-3">Working Hours</th>
                        <th className="p-3.5 text-left font-semibold uppercase tracking-wider text-ink-3">Status</th>
                        <th className="p-3.5 text-left font-semibold uppercase tracking-wider text-ink-3">Shift</th>
                        <th className="p-3.5 text-left font-semibold uppercase tracking-wider text-ink-3">Notes</th>
                        <th className="p-3.5 text-right font-semibold uppercase tracking-wider text-ink-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/30">
                      {attendanceData.records.map((r: any) => (
                        <tr key={r.id} className="hover:bg-line/10 transition-colors">
                          <td className="p-3.5 font-mono font-medium text-ink">{r.date}</td>
                          <td className="p-3.5 text-ink-2">{r.day}</td>
                          <td className="p-3.5 font-mono text-ink">{r.checkIn}</td>
                          <td className="p-3.5 font-mono text-ink">{r.checkOut}</td>
                          <td className="p-3.5 font-mono font-semibold text-ink">{r.workingHours}</td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadgeStyle(r.status)}`}>
                              {r.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-3.5 text-ink-2">{r.shift || 'General'}</td>
                          <td className="p-3.5 text-ink-3 max-w-xs truncate" title={r.notes || ''}>
                            {r.notes || '—'}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => openCorrectionForRecord(r)}
                              className="px-2.5 py-1 rounded bg-paper-2 hover:bg-paper-3 border border-line text-xs font-semibold text-ink transition-all cursor-pointer"
                              title="Correct attendance for this date"
                            >
                              ✏️ Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: SHIFTS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'shifts' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="card p-5 flex justify-between items-center" style={{ background: 'var(--paper-1)' }}>
            <div>
              <h4 className="text-base font-bold text-ink">Scheduled Shifts & Rotations</h4>
              <p className="text-xs text-ink-3 mt-0.5">Manage working shift allocations and view punctuality compliance.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddShiftModal(true)}
              className="px-4 py-2 rounded-xl bg-turmeric text-[#2A1607] text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>+</span>
              <span>Assign Shift</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 space-y-2" style={{ background: 'var(--paper-1)' }}>
              <span className="text-[10px] uppercase font-bold text-ink-3">Current Active Shift</span>
              <h3 className="text-lg font-bold text-ink">
                {staff.currentShift || (staff.active ? 'Floor Working Shift' : 'Off Duty')}
              </h3>
              <p className="text-xs text-ink-3">
                {staff.active ? 'Staff member is currently active in the directory roster.' : 'Currently marked as off duty.'}
              </p>
            </div>
            <div className="card p-4 space-y-2" style={{ background: 'var(--paper-1)' }}>
              <span className="text-[10px] uppercase font-bold text-ink-3">Assigned Schedule</span>
              <h3 className="text-lg font-bold text-ink">Morning / General</h3>
              <p className="text-xs text-ink-3">Standard 09:30 AM to 05:30 PM (8h 00m standard working hours)</p>
            </div>
            <div className="card p-4 space-y-2" style={{ background: 'var(--paper-1)' }}>
              <span className="text-[10px] uppercase font-bold text-ink-3">Grace Period Policy</span>
              <h3 className="text-lg font-bold text-turmeric font-mono">15 Minutes</h3>
              <p className="text-xs text-ink-3">Arrivals within 15 mins of shift start are marked as on-time Present.</p>
            </div>
          </div>

          {/* Shifts History Table */}
          <div className="card overflow-hidden" style={{ background: 'var(--paper-1)' }}>
            <div className="p-4 border-b border-line">
              <h5 className="font-bold text-xs text-ink">Shift Schedule Roster</h5>
            </div>
            {(!attendanceData?.shifts || attendanceData.shifts.length === 0) ? (
              <div className="p-8 text-center text-xs text-ink-3">
                No custom scheduled shifts assigned yet. Standard store hours apply.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="rtable w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--paper-2)' }}>
                      <th className="p-3 text-left font-semibold text-ink-3">Start Time</th>
                      <th className="p-3 text-left font-semibold text-ink-3">End Time</th>
                      <th className="p-3 text-left font-semibold text-ink-3">Role</th>
                      <th className="p-3 text-left font-semibold text-ink-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/30">
                    {attendanceData.shifts.map((s: any) => (
                      <tr key={s.id} className="hover:bg-line/10">
                        <td className="p-3 font-mono text-ink">{new Date(s.startsAt).toLocaleString('en-IN')}</td>
                        <td className="p-3 font-mono text-ink">{new Date(s.endsAt).toLocaleString('en-IN')}</td>
                        <td className="p-3 capitalize text-ink-2">{s.role || staff.role}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 uppercase">
                            {s.status || 'Scheduled'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: PERMISSIONS (FULL RBAC MATRIX)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'permissions' && (
        <div className="card p-5 space-y-4 animate-in fade-in duration-150" style={{ background: 'var(--paper-1)' }}>
          <div className="flex justify-between items-center border-b border-line pb-3">
            <div>
              <h4 className="text-base font-bold text-ink">Access Control & Role Permissions</h4>
              <p className="text-xs text-ink-3 mt-0.5">
                Role capabilities for <b className="text-ink">{staff.name}</b> across all POS, Kitchen, and Dashboard surfaces.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-3">
                Assigned Role: <b className="capitalize text-ink">{ROLE_LABELS[staff.role as StaffRole] || staff.role}</b>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-paper-2 border border-line space-y-3">
              <span className="block text-xs font-bold text-ink uppercase">Multi-Role Selection</span>
              <div className="flex flex-wrap gap-2">
                {ALL_ROLES.map((r) => (
                  <span
                    key={r}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize ${
                      staff.assignedRoles?.includes(r) || staff.role === r
                        ? 'bg-turmeric text-[#2A1607] border-turmeric'
                        : 'bg-paper-3 text-ink-3 border-line'
                    }`}
                  >
                    {ROLE_LABELS[r as StaffRole] || r}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-paper-2 border border-line space-y-3">
              <span className="block text-xs font-bold text-ink uppercase">Floor Station / Printer Routing</span>
              <p className="text-xs text-ink-3">
                Floor station assignment determines which receipt printer orders taken by this staff member route to.
              </p>
              <div className="p-2.5 rounded-lg bg-paper-3 border border-line font-mono text-xs font-semibold text-ink flex items-center gap-2">
                <span>📍</span>
                <span>{staff.stationName || formatStationBadge(staff.station || 'p1', waiterStations)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-paper-2 border border-line space-y-3">
            <span className="block text-xs font-bold text-ink uppercase">Operational Permissions Summary</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
              {PERMISSION_MODULES.slice(0, 8).map((mod) => (
                <div key={mod.category} className="p-2.5 rounded-lg bg-paper-3 border border-line/50">
                  <span className="block font-bold text-ink truncate">{mod.category}</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    ✓ {mod.permissions.length} actions enabled
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: ACCOUNT & SECURITY (PASSWORD MANAGEMENT)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-150">
          {/* Dashboard Password & Login ID */}
          <div className="card p-5 space-y-4" style={{ background: 'var(--paper-1)' }}>
            <div className="border-b border-line pb-2.5">
              <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
                <span>🔐</span> Staff Login & Password Credentials
              </h4>
              <p className="text-xs text-ink-3 mt-0.5">Manage staff dashboard login ID and scrypt-hashed credentials.</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center p-3 rounded-xl bg-paper-2 border border-line">
                <div>
                  <span className="block text-ink-3 text-[10px] uppercase font-bold">Username / Login ID</span>
                  <span className="font-mono text-sm font-bold text-turmeric">{staff.username || 'No login configured'}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                  {staff.active ? 'ACTIVE ACCOUNT' : 'SUSPENDED'}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl bg-paper-2 border border-line">
                <div>
                  <span className="block text-ink-3 text-[10px] uppercase font-bold">Account Password</span>
                  <span className="font-mono text-sm tracking-widest text-ink font-bold">••••••••••••</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPwError(null);
                      setPwSuccess(null);
                      setShowChangePwModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-turmeric text-[#2A1607] font-bold text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                  >
                    Change Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminResetError(null);
                      setAdminResetSuccess(null);
                      setShowResetPwModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-paper-3 hover:bg-paper-2 border border-line text-ink font-semibold text-xs transition-all cursor-pointer"
                  >
                    Reset Password
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-ink-2 space-y-1">
                <span className="font-bold flex items-center gap-1 text-amber-700 dark:text-amber-300">
                  <span>🔒</span> Security & Cryptography Policy
                </span>
                <p className="text-[11px] text-ink-3 leading-relaxed">
                  Passwords are cryptographically secured using salted Scrypt derivation. Passwords are never stored in plaintext, never logged, and never returned in API payloads.
                </p>
              </div>
            </div>
          </div>

          {/* POS Quick Access PIN */}
          <div className="card p-5 space-y-4" style={{ background: 'var(--paper-1)' }}>
            <div className="border-b border-line pb-2.5">
              <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
                <span>🔢</span> POS Quick Access PIN
              </h4>
              <p className="text-xs text-ink-3 mt-0.5">Fast 4–6 digit numeric PIN for cashier and waiter terminal sign-in.</p>
            </div>

            {pinMsg && (
              <div className={`p-2.5 rounded-lg text-xs ${pinMsg.type === 'ok' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                {pinMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdatePin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">Set New Numeric PIN (4–6 digits)</label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-sm font-mono tracking-widest focus:outline-none focus:border-turmeric"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={pinLoading || newPin.length < 4}
                  className="px-4 py-2 rounded-lg bg-turmeric text-[#2A1607] font-bold text-xs hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {pinLoading ? 'Updating PIN…' : 'Update POS PIN'}
                </button>
              </div>
            </form>

            <div className="border-t border-line pt-3 text-xs text-ink-3 space-y-1.5">
              <div className="flex justify-between">
                <span>PIN Status</span>
                <span className="font-semibold text-ink">{staff.hasPin ? 'Configured & Active' : 'Not Configured'}</span>
              </div>
              <div className="flex justify-between">
                <span>Account Created</span>
                <span className="font-mono text-ink">
                  {staff.createdAt ? new Date(staff.createdAt).toLocaleDateString('en-IN') : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 6: AUDIT LOGS (STAFF-SPECIFIC AUDIT TRAIL)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="card p-5 space-y-4 animate-in fade-in duration-150" style={{ background: 'var(--paper-1)' }}>
          <div className="flex justify-between items-center border-b border-line pb-3">
            <div>
              <h4 className="text-base font-bold text-ink">Staff Audit Trail & Compliance Ledger</h4>
              <p className="text-xs text-ink-3 mt-0.5">
                Audited security events, attendance corrections, and account modifications for <b className="text-ink">{staff.name}</b>.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAuditLogs}
              className="px-3 py-1.5 rounded-lg border border-line bg-paper-2 hover:bg-paper-3 text-xs font-semibold text-ink transition-all cursor-pointer"
            >
              🔄 Refresh Logs
            </button>
          </div>

          {auditLoading ? (
            <div className="p-8 text-center text-xs text-ink-3">Loading staff audit ledger…</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-3">
              No audit events recorded for this staff member yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="rtable w-full text-xs border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--paper-2)' }}>
                    <th className="p-3 text-left font-semibold text-ink-3">Operator</th>
                    <th className="p-3 text-left font-semibold text-ink-3">Action</th>
                    <th className="p-3 text-left font-semibold text-ink-3">Details / Reason</th>
                    <th className="p-3 text-right font-semibold text-ink-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/30">
                  {auditLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-line/10">
                      <td className="p-3 font-semibold text-ink">{log.actorName || 'System'}</td>
                      <td className="p-3 font-mono text-turmeric font-medium">{log.action}</td>
                      <td className="p-3 text-ink-2">
                        {log.after?.reason ? (
                          <span>Reason: <b>{log.after.reason}</b></span>
                        ) : log.after?.status ? (
                          <span>Status set to <b>{log.after.status}</b></span>
                        ) : log.after?.targetName ? (
                          <span>Target: {log.after.targetName}</span>
                        ) : (
                          'Modified'
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-ink-3">
                        {new Date(log.at).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: EDIT STAFF PROFILE
      ───────────────────────────────────────────────────────────── */}
      {showEditModal && (
        <div
          onClick={() => !editSaving && setShowEditModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-paper border border-line rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-line pb-3">
              <h3 className="font-bold text-base text-ink">Edit Staff Profile</h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-ink-3 hover:text-ink text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-red-500/10 text-red-600 text-xs">{editError}</div>
            )}

            <form onSubmit={handleEditProfileSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Employee Code</label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Phone Number</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Email Address</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Designation / Title</label>
                  <input
                    type="text"
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                    placeholder="e.g. Head Waiter"
                    className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Joining Date</label>
                  <input
                    type="date"
                    value={editJoiningDate}
                    onChange={(e) => setEditJoiningDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Pay Type</label>
                  <select
                    value={editPayType}
                    onChange={(e) => setEditPayType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric cursor-pointer"
                  >
                    <option value="">None</option>
                    <option value="monthly">Monthly Salary</option>
                    <option value="hourly">Hourly Wage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Pay Rate (₹)</label>
                  <input
                    type="number"
                    value={editPayRate}
                    onChange={(e) => setEditPayRate(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-lg bg-paper-2 hover:bg-paper-3 text-xs font-semibold text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-5 py-2 rounded-lg bg-turmeric text-[#2A1607] font-bold text-xs hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: CHANGE PASSWORD (SELF / USER)
      ───────────────────────────────────────────────────────────── */}
      {showChangePwModal && (
        <div
          onClick={() => !pwLoading && setShowChangePwModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-paper border border-line rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-line pb-3">
              <h3 className="font-bold text-base text-ink">Change Account Password</h3>
              <button
                type="button"
                onClick={() => setShowChangePwModal(false)}
                className="text-ink-3 hover:text-ink text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {pwError && <div className="p-3 rounded-lg bg-red-500/10 text-red-600 text-xs">{pwError}</div>}
            {pwSuccess && <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs">{pwSuccess}</div>}

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">Current Password</label>
                <input
                  type="password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">New Password (min 6 chars) *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric font-mono"
                />
                {pwNew && pwConfirm && pwNew !== pwConfirm && (
                  <span className="text-[10px] text-red-500 block mt-1">Passwords do not match.</span>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowChangePwModal(false)}
                  className="px-4 py-2 rounded-lg bg-paper-2 hover:bg-paper-3 text-xs font-semibold text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwLoading || pwNew.length < 6 || pwNew !== pwConfirm}
                  className="px-5 py-2 rounded-lg bg-turmeric text-[#2A1607] font-bold text-xs hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {pwLoading ? 'Saving…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: ADMIN RESET PASSWORD CONFIRMATION
      ───────────────────────────────────────────────────────────── */}
      {showResetPwModal && (
        <div
          onClick={() => !adminResetLoading && setShowResetPwModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-paper border border-line rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-line pb-3">
              <h3 className="font-bold text-base text-ink">Reset Staff Password</h3>
              <button
                type="button"
                onClick={() => setShowResetPwModal(false)}
                className="text-ink-3 hover:text-ink text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-ink-3">
              Reset login credentials for <b className="text-ink">{staff.name}</b>. This change will be audited.
            </p>

            {adminResetError && <div className="p-3 rounded-lg bg-red-500/10 text-red-600 text-xs">{adminResetError}</div>}
            {adminResetSuccess && <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs">{adminResetSuccess}</div>}

            <form onSubmit={handleAdminResetPassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">New Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={adminResetNew}
                  onChange={(e) => setAdminResetNew(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={adminResetConfirm}
                  onChange={(e) => setAdminResetConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric font-mono"
                />
                {adminResetNew && adminResetConfirm && adminResetNew !== adminResetConfirm && (
                  <span className="text-[10px] text-red-500 block mt-1">Passwords do not match.</span>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowResetPwModal(false)}
                  className="px-4 py-2 rounded-lg bg-paper-2 hover:bg-paper-3 text-xs font-semibold text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminResetLoading || adminResetNew.length < 6 || adminResetNew !== adminResetConfirm}
                  className="px-5 py-2 rounded-lg bg-turmeric text-[#2A1607] font-bold text-xs hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {adminResetLoading ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 4: MARK ATTENDANCE
      ───────────────────────────────────────────────────────────── */}
      {showMarkModal && (
        <div
          onClick={() => !isSavingAttendance && setShowMarkModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-paper border border-line rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-line pb-3">
              <h3 className="font-bold text-base text-ink">Mark Attendance</h3>
              <button
                type="button"
                onClick={() => setShowMarkModal(false)}
                className="text-ink-3 hover:text-ink text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleMarkAttendanceSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">Date *</label>
                <input
                  type="date"
                  required
                  value={markForm.date}
                  onChange={(e) => setMarkForm({ ...markForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">Status *</label>
                <select
                  value={markForm.status}
                  onChange={(e) => setMarkForm({ ...markForm, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric cursor-pointer capitalize"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late Arrival</option>
                  <option value="half_day">Half Day</option>
                  <option value="leave">On Leave</option>
                  <option value="off_day">Off Day</option>
                </select>
              </div>

              {markForm.status !== 'absent' && markForm.status !== 'leave' && markForm.status !== 'off_day' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-ink-2">Check In</label>
                    <input
                      type="text"
                      value={markForm.clockIn}
                      onChange={(e) => setMarkForm({ ...markForm, clockIn: e.target.value })}
                      placeholder="09:30 AM"
                      className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-ink-2">Check Out</label>
                    <input
                      type="text"
                      value={markForm.clockOut}
                      onChange={(e) => setMarkForm({ ...markForm, clockOut: e.target.value })}
                      placeholder="05:30 PM"
                      className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">Notes</label>
                <textarea
                  rows={2}
                  value={markForm.notes}
                  onChange={(e) => setMarkForm({ ...markForm, notes: e.target.value })}
                  placeholder="Optional notes or context..."
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowMarkModal(false)}
                  className="px-4 py-2 rounded-lg bg-paper-2 hover:bg-paper-3 text-xs font-semibold text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAttendance}
                  className="px-5 py-2 rounded-lg bg-turmeric text-[#2A1607] font-bold text-xs hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSavingAttendance ? 'Saving…' : 'Save Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 5: ATTENDANCE CORRECTION (AUDITED WITH REASON)
      ───────────────────────────────────────────────────────────── */}
      {showCorrectModal && (
        <div
          onClick={() => !isSavingAttendance && setShowCorrectModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-paper border border-line rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-line pb-3">
              <div>
                <h3 className="font-bold text-base text-ink">Correct Attendance Record</h3>
                <span className="text-[11px] text-ink-3">Changes are audited with full before/after history</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCorrectModal(false)}
                className="text-ink-3 hover:text-ink text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCorrectAttendanceSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">Date *</label>
                <input
                  type="date"
                  required
                  value={correctForm.date}
                  onChange={(e) => setCorrectForm({ ...correctForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Check In Time</label>
                  <input
                    type="text"
                    value={correctForm.clockIn}
                    onChange={(e) => setCorrectForm({ ...correctForm, clockIn: e.target.value })}
                    placeholder="09:30 AM"
                    className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Check Out Time</label>
                  <input
                    type="text"
                    value={correctForm.clockOut}
                    onChange={(e) => setCorrectForm({ ...correctForm, clockOut: e.target.value })}
                    placeholder="05:30 PM"
                    className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">Status</label>
                <select
                  value={correctForm.status}
                  onChange={(e) => setCorrectForm({ ...correctForm, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric cursor-pointer capitalize"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="half_day">Half Day</option>
                  <option value="leave">Leave</option>
                  <option value="missing_checkout">Missing Checkout</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">
                  Reason for Correction * <span className="text-red-500 font-bold">(Audited)</span>
                </label>
                <input
                  type="text"
                  required
                  value={correctForm.reason}
                  onChange={(e) => setCorrectForm({ ...correctForm, reason: e.target.value })}
                  placeholder="e.g. Forgot checkout, system clock skew"
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">Additional Notes</label>
                <textarea
                  rows={2}
                  value={correctForm.notes}
                  onChange={(e) => setCorrectForm({ ...correctForm, notes: e.target.value })}
                  placeholder="Notes..."
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowCorrectModal(false)}
                  className="px-4 py-2 rounded-lg bg-paper-2 hover:bg-paper-3 text-xs font-semibold text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAttendance || !correctForm.reason.trim()}
                  className="px-5 py-2 rounded-lg bg-turmeric text-[#2A1607] font-bold text-xs hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSavingAttendance ? 'Saving Correction…' : 'Save & Log to Audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 6: ASSIGN SHIFT
      ───────────────────────────────────────────────────────────── */}
      {showAddShiftModal && (
        <div
          onClick={() => !isSavingShift && setShowAddShiftModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-paper border border-line rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-line pb-3">
              <h3 className="font-bold text-base text-ink">Assign Working Shift</h3>
              <button
                type="button"
                onClick={() => setShowAddShiftModal(false)}
                className="text-ink-3 hover:text-ink text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddShift} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">Shift Date *</label>
                <input
                  type="date"
                  required
                  value={shiftForm.date}
                  onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Start Time</label>
                  <input
                    type="time"
                    required
                    value={shiftForm.start}
                    onChange={(e) => setShiftForm({ ...shiftForm, start: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">End Time</label>
                  <input
                    type="time"
                    required
                    value={shiftForm.end}
                    onChange={(e) => setShiftForm({ ...shiftForm, end: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">Shift Role</label>
                <select
                  value={shiftForm.role}
                  onChange={(e) => setShiftForm({ ...shiftForm, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-xs focus:outline-none focus:border-turmeric cursor-pointer capitalize"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r as StaffRole] || r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddShiftModal(false)}
                  className="px-4 py-2 rounded-lg bg-paper-2 hover:bg-paper-3 text-xs font-semibold text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingShift}
                  className="px-5 py-2 rounded-lg bg-turmeric text-[#2A1607] font-bold text-xs hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSavingShift ? 'Assigning…' : 'Assign Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
