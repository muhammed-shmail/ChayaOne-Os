'use client';

import { useState, useEffect } from 'react';
import { formatINR } from '@cafeos/core';
import type { StaffRole } from '@cafeos/db';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ALL_ROLES, PERMISSION_MODULES, PRESETS, resolvePrimaryRole, type PermissionItem } from '@/lib/rbac';
import { DEFAULT_WAITER_STATIONS, type WaiterStation, formatStationBadge } from '@/lib/waiter-stations';

interface CustomSelectOption {
  value: string;
  label: string;
}

function CustomSelect({
  value,
  onChange,
  options,
  label
}: {
  value: string;
  onChange: (val: string) => void;
  options: CustomSelectOption[];
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = () => setIsOpen(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      {label && <label className="block text-xs font-semibold mb-1 text-ink-2">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded-lg bg-paper-3 border border-line text-ink text-left text-xs capitalize flex justify-between items-center transition-all hover:bg-paper-3/80 focus:outline-none focus:border-turmeric min-h-[36px]"
      >
        <span>{selectedOption?.label}</span>
        <span className="text-[10px] text-ink-3 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
          ▼
        </span>
      </button>

      {isOpen && (
        <ul
          className="absolute left-0 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-line z-50 shadow-lg select-scrollbar py-1"
          style={{ background: 'var(--paper-2)' }}
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`px-3 py-2 text-xs cursor-pointer capitalize transition-all flex items-center justify-between ${
                opt.value === value
                  ? 'bg-turmeric text-[#2A1607] font-semibold'
                  : 'text-ink-2 hover:bg-line/20 hover:text-ink'
              }`}
            >
              <span>{opt.label}</span>
              {opt.value === value && <span className="text-[10px]">✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DATA_RESTRICTION_OPTIONS = [
  { key: 'own_sales', label: 'View only own sales' },
  { key: 'own_shift', label: 'View own shift logs' },
  { key: 'assigned_tables', label: 'View assigned tables only' },
  { key: 'assigned_branch', label: 'View assigned branch only' },
  { key: 'all_branches', label: 'View all branches' },
  { key: 'today_reports', label: 'View only today\'s reports' },
  { key: 'finance_reports_only', label: 'View financial reports only' }
];

const BRANCH_OPTIONS = [
  { id: 'main-branch', name: 'Main Branch' }
];

interface AuditLogEntry {
  who: string;
  action: string;
  target: string;
  branch: string;
  device: string;
  timestamp: string;
}

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

export default function StaffRBACManagement({ d, refresh }: { d: any; refresh: () => void }) {
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'permissions' | 'audit'>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  
  // Selected staff user for detail views
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  
  // Permissions & configurations state for editing
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [branchAccess, setBranchAccess] = useState<string[]>([]);
  const [customPermissions, setCustomPermissions] = useState<string[]>([]);
  const [dataRestrictions, setDataRestrictions] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(PERMISSION_MODULES.map(c => c.category));
  const [permissionFilter, setPermissionFilter] = useState('');
  const [loginMethod, setLoginMethod] = useState<'pin' | 'password'>('pin');

  // UI state indicators
  const [isModified, setIsModified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form states for creating staff
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffCode, setNewStaffCode] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<string>('waiter');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffPayType, setNewStaffPayType] = useState<'monthly' | 'hourly' | ''>('');
  const [newStaffPayRate, setNewStaffPayRate] = useState('');
  const [newStaffDesignation, setNewStaffDesignation] = useState('');
  const [newStaffJoiningDate, setNewStaffJoiningDate] = useState('');

  // Re-usable custom roles
  const [customRoles, setCustomRoles] = useState<{ id: string; name: string; baseRole?: string }[]>([]);
  const [showNewRoleInput, setShowNewRoleInput] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleBase, setNewRoleBase] = useState<string>('waiter');
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  // Waiter section / station arrangement (P1 Lower, P2 Upper, and custom stations)
  const [waiterStations, setWaiterStations] = useState<WaiterStation[]>(DEFAULT_WAITER_STATIONS);
  const [selectedStation, setSelectedStation] = useState<string>('p1');
  const [showNewStationInput, setShowNewStationInput] = useState(false);
  const [newStationCode, setNewStationCode] = useState('');
  const [newStationName, setNewStationName] = useState('');
  const [isCreatingStation, setIsCreatingStation] = useState(false);
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [stationToDelete, setStationToDelete] = useState<WaiterStation | null>(null);
  const [isDeletingStation, setIsDeletingStation] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<any | null>(null);
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);

  // Local copy of members with nested metadata parsing
  const [membersList, setMembersList] = useState<any[]>([]);

  useEffect(() => {
    if (d?.customRoles && Array.isArray(d.customRoles)) {
      setCustomRoles(d.customRoles.map((r: any) => ({
        id: r.id,
        name: r.name,
        baseRole: (typeof r.permissions === 'object' && r.permissions?.baseRole) || 'waiter',
      })));
    }
  }, [d?.customRoles]);

  useEffect(() => {
    if (d?.waiterStations && Array.isArray(d.waiterStations)) {
      setWaiterStations(d.waiterStations.length > 0 ? d.waiterStations : DEFAULT_WAITER_STATIONS);
    }
  }, [d?.waiterStations]);

  useEffect(() => {
    if (d?.members) {
      const formatted = d.members.map((m: any) => {
        let permissionsObj = { assignedRoles: [m.role], branchAccess: ['main-branch'], overrides: {}, dataRestrictions: [] };
        try {
          if (m.permissions && typeof m.permissions === 'string') {
            permissionsObj = JSON.parse(m.permissions);
          } else if (m.permissions && typeof m.permissions === 'object') {
            permissionsObj = { ...permissionsObj, ...m.permissions };
          }
        } catch (e) {
          console.error("Error parsing permissions json", e);
        }
        return {
          ...m,
          assignedRoles: permissionsObj.assignedRoles || [m.role],
          branchAccess: permissionsObj.branchAccess || ['main-branch'],
          overrides: permissionsObj.overrides || {},
          dataRestrictions: permissionsObj.dataRestrictions || [],
          station: (permissionsObj as any).station || (m as any).station || null,
          stationName: (permissionsObj as any).stationName || (m as any).stationName || null,
        };
      });
      setMembersList(formatted);
    }
  }, [d]);

  // Load a selected user profile values into state
  const selectStaffMember = (m: any) => {
    setSelectedStaff(m);
    setAssignedRoles(m.assignedRoles || [m.role]);
    setBranchAccess(m.branchAccess || ['main-branch']);
    setSelectedStation(m.station || m.permissions?.station || 'p1');
    
    // Resolve resolved check state
    const resolvedChecklist: string[] = [];
    const baseRoles = m.assignedRoles || [m.role];
    baseRoles.forEach((roleKey: string) => {
      const presetList = PRESETS[roleKey] || [];
      presetList.forEach(p => {
        if (!resolvedChecklist.includes(p)) resolvedChecklist.push(p);
      });
    });

    // Add overrides
    const overrides = m.overrides || {};
    const finalPermissions = [...resolvedChecklist];
    Object.keys(overrides).forEach(pkey => {
      if (overrides[pkey] === true) {
        if (!finalPermissions.includes(pkey)) finalPermissions.push(pkey);
      } else if (overrides[pkey] === false) {
        const index = finalPermissions.indexOf(pkey);
        if (index > -1) finalPermissions.splice(index, 1);
      }
    });

    setCustomPermissions(finalPermissions);
    setDataRestrictions(m.dataRestrictions || []);
    setIsModified(false);
    setSaveMessage(null);
    setErrorMessage(null);
    setActiveSubTab('permissions');
  };

  // Toggle permission checks
  const handleTogglePermission = (permKey: string, action: string) => {
    const fullKey = `${permKey}:${action}`;
    setCustomPermissions(prev => {
      const next = prev.includes(fullKey) ? prev.filter(x => x !== fullKey) : [...prev, fullKey];
      setIsModified(true);
      return next;
    });
  };

  // Toggle roles check and merge permissions dynamically
  const handleToggleRole = (roleKey: string) => {
    setAssignedRoles(prev => {
      let next = [...prev];
      if (next.includes(roleKey)) {
        if (next.length > 1) {
          next = next.filter(r => r !== roleKey);
        }
      } else {
        next.push(roleKey);
      }
      setIsModified(true);

      // Re-apply cumulative merging: merge PRESETS for current roles
      const mergedList: string[] = [];
      next.forEach(r => {
        (PRESETS[r] || []).forEach(p => {
          if (!mergedList.includes(p)) mergedList.push(p);
        });
      });
      setCustomPermissions(mergedList);

      return next;
    });
  };

  const handleToggleBranch = (branchId: string) => {
    setBranchAccess(prev => {
      const next = prev.includes(branchId) ? prev.filter(b => b !== branchId) : [...prev, branchId];
      setIsModified(true);
      return next;
    });
  };

  const handleToggleDataRestriction = (restrictionKey: string) => {
    setDataRestrictions(prev => {
      const next = prev.includes(restrictionKey) ? prev.filter(r => r !== restrictionKey) : [...prev, restrictionKey];
      setIsModified(true);
      return next;
    });
  };

  // Bulk permission triggers
  const handleBulkPermissions = (actionType: 'select-all' | 'clear-all') => {
    if (actionType === 'select-all') {
      const all: string[] = [];
      PERMISSION_MODULES.forEach(cat => {
        cat.permissions.forEach(p => {
          p.actions.forEach(act => {
            all.push(`${p.key}:${act}`);
          });
        });
      });
      setCustomPermissions(all);
    } else {
      setCustomPermissions([]);
    }
    setIsModified(true);
  };

  const toggleAccordion = (cat: string) => {
    setExpandedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // Calculate overridden permissions to display in the UI
  const isOverridden = (permKey: string, action: string) => {
    const fullKey = `${permKey}:${action}`;
    const valueInActiveState = customPermissions.includes(fullKey);

    // What value is expected strictly from the assigned base roles?
    let expectedFromRoles = false;
    assignedRoles.forEach(r => {
      if ((PRESETS[r] || []).includes(fullKey)) expectedFromRoles = true;
    });

    return valueInActiveState !== expectedFromRoles;
  };

  // Save changes via POST staff update endpoint
  const handleSavePermissions = async () => {
    if (!selectedStaff) return;
    setIsSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);

    // Compute overrides: what differs between customPermissions and assigned base roles presets
    const basePresetPermissions: string[] = [];
    assignedRoles.forEach(r => {
      (PRESETS[r] || []).forEach(p => {
        if (!basePresetPermissions.includes(p)) basePresetPermissions.push(p);
      });
    });

    const overrides: Record<string, boolean> = {};
    
    // Explicitly enabled overrides
    customPermissions.forEach(p => {
      if (!basePresetPermissions.includes(p)) {
        overrides[p] = true;
      }
    });

    // Explicitly disabled overrides
    basePresetPermissions.forEach(p => {
      if (!customPermissions.includes(p)) {
        overrides[p] = false;
      }
    });

    const primaryRole = resolvePrimaryRole(assignedRoles, selectedStaff.role);
    const isWaiter = primaryRole.toLowerCase() === 'waiter' || assignedRoles.includes('waiter');
    const stationLabel = waiterStations.find((s) => s.id === selectedStation)?.label || selectedStation;

    const permissionsPayload = {
      assignedRoles,
      branchAccess,
      overrides,
      dataRestrictions,
      station: isWaiter ? selectedStation : undefined,
      stationName: isWaiter ? stationLabel : undefined,
    };

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: selectedStaff.id,
          role: primaryRole,
          permissions: permissionsPayload,
          station: isWaiter ? selectedStation : undefined,
          stationName: isWaiter ? stationLabel : undefined,
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Server error');
      
      setSaveMessage('RBAC permissions successfully compiled and pushed to active sessions.');
      setIsModified(false);
      
      // Update local state row
      setMembersList(prev => prev.map(m => m.id === selectedStaff.id ? {
        ...m,
        role: primaryRole,
        assignedRoles,
        branchAccess,
        overrides,
        dataRestrictions,
        station: isWaiter ? selectedStation : m.station,
        stationName: isWaiter ? stationLabel : m.stationName,
      } : m));

      // Refresh layout data
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('staff:changed'));
      setTimeout(() => refresh(), 1000);
    } catch (e: any) {
      setErrorMessage(e.message || 'Error occurred while saving modifications.');
    } finally {
      setIsSaving(false);
    }
  };

  // Create Re-usable Custom Role Action
  const handleCreateCustomRole = async () => {
    if (!newRoleName.trim()) {
      setErrorMessage('Custom role name cannot be empty');
      return;
    }
    setIsCreatingRole(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_custom_role',
          name: newRoleName.trim(),
          baseRole: newRoleBase,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to create custom role');
      const created = data.role;
      const roleItem = {
        id: created.id,
        name: created.name,
        baseRole: newRoleBase,
      };
      setCustomRoles(prev => [...prev.filter(r => r.name.toLowerCase() !== created.name.toLowerCase()), roleItem]);
      setNewStaffRole(created.name);
      setNewRoleName('');
      setShowNewRoleInput(false);
      refresh();
    } catch (e: any) {
      setErrorMessage(e.message || 'Error occurred while saving role');
    } finally {
      setIsCreatingRole(false);
    }
  };

  const handleStartEditStation = (st: WaiterStation, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingStationId(st.id);
    setNewStationCode(st.code);
    setNewStationName(st.name);
    setShowNewStationInput(true);
  };

  const handleCancelStationForm = () => {
    setShowNewStationInput(false);
    setEditingStationId(null);
    setNewStationCode('');
    setNewStationName('');
  };

  const promptDeleteStation = (st: WaiterStation, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setStationToDelete(st);
  };

  const handleConfirmDeleteStation = async () => {
    if (!stationToDelete) return;
    const stId = stationToDelete.id;
    setIsDeletingStation(true);
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_waiter_station',
          id: stId,
        }),
      });
      const data = await res.json();
      const nextList: WaiterStation[] = Array.isArray(data.waiterStations) && data.waiterStations.length > 0
        ? data.waiterStations
        : waiterStations.filter((s) => s.id !== stId);

      setWaiterStations(nextList);
      if (selectedStation === stId) {
        setSelectedStation(nextList[0]?.id || 'p1');
      }
      if (editingStationId === stId) {
        handleCancelStationForm();
      }
    } catch (err: any) {
      const nextList = waiterStations.filter((s) => s.id !== stId);
      setWaiterStations(nextList);
      if (selectedStation === stId) {
        setSelectedStation(nextList[0]?.id || 'p1');
      }
      if (editingStationId === stId) {
        handleCancelStationForm();
      }
    } finally {
      setIsDeletingStation(false);
      setStationToDelete(null);
    }
  };

  // Delete Staff Account — optimistic removal to prevent UI freeze
  const handleConfirmDeleteStaff = async () => {
    if (!staffToDelete) return;
    const sId = staffToDelete.id;
    setIsDeletingStaff(true);
    // Optimistic removal so UI updates instantly with 0ms freeze
    setMembersList(prev => prev.filter(m => m.id !== sId));
    if (selectedStaff?.id === sId) {
      setSelectedStaff(null);
      setActiveSubTab('directory');
    }
    try {
      await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', id: sId }),
      });
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('staff:changed'));
      refresh();
    } catch (err) {
      console.error('Error deleting staff:', err);
      refresh();
    } finally {
      setIsDeletingStaff(false);
      setStaffToDelete(null);
    }
  };

  // Create or Update Custom Waiter Station
  const handleCreateCustomStation = async () => {
    if (!newStationName.trim()) return;
    setIsCreatingStation(true);
    setErrorMessage(null);

    const rawCode = (newStationCode || newStationName.slice(0, 4)).trim().toUpperCase();
    const id = rawCode.toLowerCase();
    const cleanName = newStationName.trim();
    const isEditing = !!editingStationId;
    const originalId = editingStationId;

    const savedStation: WaiterStation = {
      id,
      code: rawCode,
      name: cleanName,
      label: `${rawCode} (${cleanName})`,
      desc: 'Floor Section Station',
      isCustom: true,
    };

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isEditing ? 'update_waiter_station' : 'create_waiter_station',
          originalId: originalId || undefined,
          code: rawCode,
          name: cleanName,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.message || data.error || 'Failed to save station');

      const updatedList = Array.isArray(data.waiterStations) && data.waiterStations.length > 0
        ? data.waiterStations
        : [
            ...waiterStations.filter((s) => s.id !== originalId && s.id !== id),
            savedStation,
          ];

      setWaiterStations(updatedList);
      if (selectedStation === originalId || !selectedStation) {
        setSelectedStation(id);
      }
      handleCancelStationForm();
    } catch (err: any) {
      // Fallback: persist in local state so UI is never blocked
      setWaiterStations((prev) => [
        ...prev.filter((s) => s.id !== originalId && s.id !== id),
        savedStation,
      ]);
      if (selectedStation === originalId || !selectedStation) {
        setSelectedStation(id);
      }
      handleCancelStationForm();
    } finally {
      setIsCreatingStation(false);
    }
  };

  // Create Staff Action
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!newStaffName.trim()) return setErrorMessage('Full Name is required');
    if (!newStaffEmail.trim()) return setErrorMessage('Username / Email is required');
    if (!newStaffPassword || newStaffPassword.length < 6) return setErrorMessage('Password must be at least 6 characters');
    if (newStaffPin && !/^\d{4,6}$/.test(newStaffPin)) return setErrorMessage('PIN must be 4–6 digits');

    // Build pay rate in paise (100 paise = ₹1)
    const payRatePaise = newStaffPayRate && newStaffPayType
      ? Math.round(parseFloat(newStaffPayRate) * 100)
      : null;

    const isCustom = !ALL_ROLES.includes(newStaffRole as StaffRole);
    const customRoleObj = customRoles.find(r => r.name.toLowerCase() === newStaffRole.toLowerCase());
    const baseRole = isCustom ? (customRoleObj?.baseRole || 'waiter') : newStaffRole;

    const isWaiter = baseRole.toLowerCase() === 'waiter' || newStaffRole.toLowerCase() === 'waiter';
    const assignedStation = isWaiter ? selectedStation : undefined;
    const assignedStationLabel = isWaiter ? (waiterStations.find(s => s.id === selectedStation)?.label || selectedStation) : undefined;

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: newStaffName,
          role: newStaffRole,
          baseRole: baseRole,
          customRole: isCustom ? newStaffRole : undefined,
          phone: newStaffPhone || null,
          employeeCode: newStaffCode || null,
          username: newStaffEmail.trim(),
          password: newStaffPassword,
          pin: newStaffPin || null,
          payType: newStaffPayType || null,
          payRatePaise,
          designation: newStaffDesignation || null,
          joiningDate: newStaffJoiningDate || null,
          station: assignedStation,
          stationName: assignedStationLabel,
          permissions: {
            assignedRoles: isCustom ? [newStaffRole, baseRole] : [newStaffRole],
            baseRole,
            branchAccess: ['main-branch'],
            overrides: {},
            dataRestrictions: [],
            station: assignedStation,
            stationName: assignedStationLabel,
          }
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.message || data.error || 'Error saving staff member');

      setShowAddModal(false);
      // Reset form states
      setNewStaffName('');
      setNewStaffPhone('');
      setNewStaffEmail('');
      setNewStaffCode('');
      setNewStaffPassword('');
      setNewStaffRole('waiter');
      setNewStaffPin('');
      setNewStaffPayType('');
      setNewStaffPayRate('');
      setNewStaffDesignation('');
      setNewStaffJoiningDate('');
      
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('staff:changed'));
      refresh();
    } catch (e: any) {
      setErrorMessage(e.message || 'Verification failed while saving.');
    }
  };

  // Quick Action: Deactivate/Suspend toggle
  const handleToggleStatus = async (m: any) => {
    const nextActive = !m.active;
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: m.id,
          active: nextActive
        })
      });
      if (res.ok) {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('staff:changed'));
        refresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter members list based on state triggers
  const filteredMembers = membersList.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (m.phone && m.phone.includes(searchQuery)) ||
                          (m.employeeCode && m.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || m.assignedRoles.includes(roleFilter) || m.role === roleFilter;
    
    const matchesBranch = branchFilter === 'all' || m.branchAccess.includes(branchFilter);
    
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && m.active) || 
                          (statusFilter === 'inactive' && !m.active);

    return matchesSearch && matchesRole && matchesBranch && matchesStatus;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-1">
      {/* Header Stat Widgets */}
      <section className="card p-4">
        <span className="block text-xs mb-2" style={{ color: 'var(--ink-3)' }}>Global Roster Size</span>
        <span className="block text-2xl md:text-3xl font-bold tnum font-mono">{membersList.length}</span>
      </section>
      <section className="card p-4">
        <span className="block text-xs mb-2" style={{ color: 'var(--ink-3)' }}>Active Personnel</span>
        <span className="block text-2xl md:text-3xl font-bold tnum font-mono" style={{ color: 'var(--cardamom-d)' }}>
          {membersList.filter(m => m.active).length}
        </span>
      </section>
      <section className="card p-4">
        <span className="block text-xs mb-2" style={{ color: 'var(--ink-3)' }}>Assigned Branches</span>
        <span className="block text-2xl md:text-3xl font-bold tnum font-mono">{BRANCH_OPTIONS.length} {BRANCH_OPTIONS.length === 1 ? 'Outlet' : 'Outlets'}</span>
      </section>
      <section className="card p-4">
        <span className="block text-xs mb-2" style={{ color: 'var(--ink-3)' }}>Enforced Security Profile</span>
        <span className="block text-sm md:text-base font-bold text-turmeric mt-2 font-mono">PIN + SHA-256</span>
      </section>

      {/* Navigation Sub-Tabs */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-line pb-2 gap-4 mt-2">
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => { setActiveSubTab('directory'); setSelectedStaff(null); }}
            className={`px-4 py-2 border-b-2 font-medium text-sm transition-all whitespace-nowrap capitalize ${
              activeSubTab === 'directory'
                ? 'border-turmeric text-turmeric font-semibold'
                : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            Staff Directory
          </button>
          {selectedStaff && (
            <button
              onClick={() => setActiveSubTab('permissions')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-all whitespace-nowrap capitalize ${
                activeSubTab === 'permissions'
                  ? 'border-turmeric text-turmeric font-semibold'
                  : 'border-transparent text-ink-3 hover:text-ink'
              }`}
            >
              Configure permissions ({selectedStaff.name})
            </button>
          )}
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-4 py-2 border-b-2 font-medium text-sm transition-all whitespace-nowrap capitalize ${
              activeSubTab === 'audit'
                ? 'border-turmeric text-turmeric font-semibold'
                : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            Audit Logs
          </button>
        </div>

        <div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-turmeric text-[#2A1607] font-semibold text-sm hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Staff Member
          </button>
        </div>
      </div>

      {/* Main Tab Rendering */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-2">
        {/* DIRECTORY VIEW */}
        {activeSubTab === 'directory' && (
          <div className="space-y-4">
            {/* Filtering Pane */}
            <div className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-3" style={{ background: 'var(--paper-2)' }}>
              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">Search Directory</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, phone, code..."
                  className="w-full px-3 py-2 rounded bg-paper-3 border border-line text-ink focus:outline-none focus:border-turmeric text-xs font-mono"
                />
              </div>
              <CustomSelect
                value={roleFilter}
                onChange={setRoleFilter}
                options={[
                  { value: 'all', label: 'All Roles' },
                  ...ALL_ROLES.map(r => ({ value: r, label: ROLE_LABELS[r as StaffRole] || r })),
                  { value: 'delivery', label: 'Delivery Staff' },
                  { value: 'inventory', label: 'Inventory Manager' },
                  ...customRoles.map(cr => ({ value: cr.name, label: cr.name }))
                ]}
                label="Filter Role"
              />
              <CustomSelect
                value={branchFilter}
                onChange={setBranchFilter}
                options={[
                  { value: 'all', label: 'All Branches' },
                  ...BRANCH_OPTIONS.map(b => ({ value: b.id, label: b.name }))
                ]}
                label="Filter Branch"
              />
              <CustomSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'active', label: 'Active Only' },
                  { value: 'inactive', label: 'Inactive / Suspended' }
                ]}
                label="Filter Status"
              />
            </div>

            {/* Directory List Table */}
            {filteredMembers.length === 0 ? (
              <div className="card p-8 text-center text-ink-3">
                <span className="block text-lg mb-2">No matching staff accounts found.</span>
                <span className="text-xs">Adjust your filters or add a new staff member to populate this view.</span>
              </div>
            ) : (
              <div className="card overflow-hidden" style={{ background: 'var(--paper-1)' }}>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--paper-2)' }}>
                        <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Employee</th>
                        <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Role Badges</th>
                        <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Branches</th>
                        <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Status</th>
                        <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Last Login</th>
                        <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Current Shift</th>
                        <th className="p-4 text-right text-xs font-semibold uppercase tracking-wider text-ink-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/30">
                      {filteredMembers.map((m) => {
                        const loginText = m.lastLoginAt
                          ? new Date(m.lastLoginAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
                          : (m.updatedAt ? new Date(m.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Never');
                        const shiftText = m.currentShift || (m.active ? 'Active Shift' : 'Off Shift');

                        return (
                          <tr key={m.id} className="hover:bg-line/10 transition-colors">
                            {/* Employee profile column */}
                            <td className="p-4" data-label="Employee">
                              <div className="flex items-center gap-3">
                                <span className="grid place-items-center w-8 h-8 rounded-full text-xs font-bold font-mono shrink-0" style={{ background: 'var(--turmeric-l)', color: '#2A1607' }}>
                                  {m.name.slice(0, 2).toUpperCase()}
                                </span>
                                <div className="text-left">
                                  <span className="font-semibold text-ink block leading-snug">{m.name}</span>
                                  <span className="text-[10px] text-ink-3 font-mono block">Code: {m.employeeCode || '—'} · {m.phone || 'No Phone'}</span>
                                </div>
                              </div>
                            </td>

                            {/* Roles badges column */}
                            <td className="p-4" data-label="Roles">
                              <div className="flex gap-1 flex-wrap items-center">
                                {m.assignedRoles.map((roleKey: string) => (
                                  <span key={roleKey} className="text-[10px] px-2 py-0.5 rounded-md bg-paper-3 border border-line font-medium capitalize text-ink-2">
                                    {ROLE_LABELS[roleKey as StaffRole] || roleKey}
                                  </span>
                                ))}
                                {m.station && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1" title="Assigned Waiter Floor Section / Station">
                                    <span>📍</span>
                                    <span>{m.stationName || formatStationBadge(m.station, waiterStations)}</span>
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Branches assignment column */}
                            <td className="p-4" data-label="Branches">
                              <span className="text-xs text-ink-2 capitalize">
                                {m.branchAccess.map((b: string) => b.replace('-branch', ' ')).join(', ') || '—'}
                              </span>
                            </td>

                            {/* Status column */}
                            <td className="p-4" data-label="Status">
                              <div className="flex items-center gap-1.5 justify-end md:justify-start">
                                <span className={`w-2 h-2 rounded-full ${m.active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                <span className="text-xs text-ink-2 capitalize">{m.active ? 'Active' : 'Suspended'}</span>
                              </div>
                            </td>

                            {/* Last Login column */}
                            <td className="p-4" data-label="Last Login">
                              <span className="text-xs font-mono text-ink-3">{loginText}</span>
                            </td>

                            {/* Shift Status column */}
                            <td className="p-4" data-label="Shift">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                shiftText.includes('Off') ? 'bg-paper-3 text-ink-3' : 'bg-green-500/10 text-green-500 border border-green-500/20'
                              }`}>
                                {shiftText}
                              </span>
                            </td>

                            {/* Actions column */}
                            <td className="p-4 text-right" data-label="Actions">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => selectStaffMember(m)}
                                  className="px-2 py-1 rounded bg-paper-3 hover:bg-line text-xs font-semibold text-ink transition-all flex items-center gap-1"
                                  title="Configure RBAC Permissions"
                                >
                                  🔑 <span className="hidden sm:inline">Permissions</span>
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(m)}
                                  className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                                    m.active ? 'bg-red-950/20 hover:bg-red-950/40 text-red-500' : 'bg-green-950/20 hover:bg-green-950/40 text-green-500'
                                  }`}
                                >
                                  {m.active ? 'Suspend' : 'Activate'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStaffToDelete(m)}
                                  className="px-2 py-1 rounded hover:bg-red-500/10 text-ink-3 hover:text-red-500 transition-all text-xs cursor-pointer"
                                  title="Delete Staff Account"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECURITY & AUDIT VIEW */}
        {activeSubTab === 'audit' && (
          <div className="card p-5 space-y-4" style={{ background: 'var(--paper-1)' }}>
            <div className="flex justify-between items-center">
              <h4 className="text-base font-bold">Audit Ledger History (Security logs)</h4>
              <button 
                onClick={() => alert("Audit logs exported to CSV.")}
                className="px-3 py-1.5 rounded bg-paper-3 hover:bg-line text-xs font-semibold font-mono"
              >
                📥 Export Ledger
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="rtable w-full text-xs border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th className="pb-2 text-left font-semibold" style={{ color: 'var(--ink-3)' }}>Operator</th>
                    <th className="pb-2 text-left font-semibold" style={{ color: 'var(--ink-3)' }}>Action / Modification</th>
                    <th className="pb-2 text-left font-semibold" style={{ color: 'var(--ink-3)' }}>Target Scope</th>
                    <th className="pb-2 text-left font-semibold" style={{ color: 'var(--ink-3)' }}>Branch</th>
                    <th className="pb-2 text-left font-semibold" style={{ color: 'var(--ink-3)' }}>Device / IP</th>
                    <th className="pb-2 text-right font-semibold" style={{ color: 'var(--ink-3)' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {INITIAL_AUDIT_LOGS.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-ink-3 text-xs">
                        No security or permission modification audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    INITIAL_AUDIT_LOGS.map((log, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid var(--line)' }} className="hover:bg-line/20">
                        <td className="py-2.5 font-bold text-ink">{log.who}</td>
                        <td className="py-2.5 font-mono text-turmeric">{log.action}</td>
                        <td className="py-2.5 text-ink-2">{log.target}</td>
                        <td className="py-2.5 text-ink-2">{log.branch}</td>
                        <td className="py-2.5 font-mono text-[10px] text-ink-3">{log.device}</td>
                        <td className="py-2.5 text-right font-mono text-ink-2">{log.timestamp}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RBAC MATRIX & PERMISSION EDITOR */}
        {activeSubTab === 'permissions' && selectedStaff && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Role mapping & details */}
            <div className="space-y-4 lg:col-span-1">
              {/* Profile Card */}
              <div className="card p-5 space-y-4" style={{ background: 'var(--paper-1)' }}>
                <div className="flex gap-4 items-center">
                  <span className="grid place-items-center w-14 h-14 rounded-full text-xl font-bold shrink-0 font-mono" style={{ background: 'var(--turmeric-l)', color: '#2A1607' }}>
                    {selectedStaff.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <h3 className="font-bold text-lg">{selectedStaff.name}</h3>
                    <span className="text-xs text-ink-3 block">ID: {selectedStaff.employeeCode || '—'}</span>
                    <span className="text-xs text-ink-3 font-mono">{selectedStaff.phone || 'No phone'}</span>
                  </div>
                </div>

                <div className="border-t border-line/50 pt-4 space-y-3">
                  <span className="block text-xs font-bold text-ink-2 uppercase tracking-wide">Multi-Role Selection</span>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_ROLES.map((roleKey) => (
                      <label 
                        key={roleKey} 
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                          assignedRoles.includes(roleKey)
                            ? 'bg-turmeric-l/10 border-turmeric text-turmeric font-bold'
                            : 'bg-paper-3 border-line text-ink-3 hover:border-ink-3'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={assignedRoles.includes(roleKey)}
                          onChange={() => handleToggleRole(roleKey)}
                          className="accent-turmeric"
                        />
                        <span className="capitalize">{ROLE_LABELS[roleKey as StaffRole] || roleKey}</span>
                      </label>
                    ))}
                    <label 
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                        assignedRoles.includes('delivery')
                          ? 'bg-turmeric-l/10 border-turmeric text-turmeric font-bold'
                          : 'bg-paper-3 border-line text-ink-3 hover:border-ink-3'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={assignedRoles.includes('delivery')}
                        onChange={() => handleToggleRole('delivery')}
                        className="accent-turmeric"
                      />
                      <span>Delivery Staff</span>
                    </label>
                    <label 
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                        assignedRoles.includes('inventory')
                          ? 'bg-turmeric-l/10 border-turmeric text-turmeric font-bold'
                          : 'bg-paper-3 border-line text-ink-3 hover:border-ink-3'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={assignedRoles.includes('inventory')}
                        onChange={() => handleToggleRole('inventory')}
                        className="accent-turmeric"
                      />
                      <span>Inventory Manager</span>
                    </label>
                  </div>
                  <span className="block text-[10px] text-ink-3 italic mt-1">
                    Cumulative Perms: Checked boxes from active roles will automatically merge.
                  </span>
                </div>

                {assignedRoles.includes('waiter') && (
                  <div className="border-t border-line/50 pt-4 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">📍</span>
                        <span className="block text-xs font-bold text-turmeric uppercase tracking-wide">
                          Floor Section / Station
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (showNewStationInput && !editingStationId) {
                            handleCancelStationForm();
                          } else {
                            setEditingStationId(null);
                            setNewStationCode('');
                            setNewStationName('');
                            setShowNewStationInput(true);
                          }
                        }}
                        className="text-[11px] font-semibold text-turmeric hover:underline cursor-pointer"
                      >
                        + Add Custom
                      </button>
                    </div>
                    <p className="text-[10px] text-ink-3">
                      Orders placed by this waiter will automatically print to this station's designated printer.
                    </p>

                    {showNewStationInput && (
                      <div className="p-2.5 rounded-lg border border-turmeric/40 bg-turmeric-l/5 space-y-2 mb-2 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-ink">
                            {editingStationId ? `Edit Station (${newStationCode || 'Selected'})` : 'Add Custom Floor Station'}
                          </span>
                          <button
                            type="button"
                            onClick={handleCancelStationForm}
                            className="text-ink-3 hover:text-ink text-xs p-0.5 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="text"
                            value={newStationCode}
                            onChange={(e) => setNewStationCode(e.target.value)}
                            placeholder="Code (e.g. P1)"
                            maxLength={8}
                            className="px-2 py-1 rounded bg-paper-3 border border-line text-xs uppercase font-bold text-ink"
                          />
                          <input
                            type="text"
                            value={newStationName}
                            onChange={(e) => setNewStationName(e.target.value)}
                            placeholder="Name (e.g. Terrace)"
                            className="px-2 py-1 rounded bg-paper-3 border border-line text-xs text-ink"
                          />
                        </div>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={handleCancelStationForm}
                            className="px-2 py-1 text-[10px] text-ink-3 hover:text-ink cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isCreatingStation || !newStationName.trim()}
                            onClick={handleCreateCustomStation}
                            className="px-2.5 py-1 rounded bg-turmeric text-[#2A1607] font-bold text-[10px] disabled:opacity-50 cursor-pointer"
                          >
                            {isCreatingStation ? 'Saving…' : (editingStationId ? 'Update' : 'Save')}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {waiterStations.map((st) => {
                        const isSel = selectedStation.toLowerCase() === st.id.toLowerCase();
                        const isBeingDeleted = isDeletingStation && stationToDelete?.id === st.id;
                        return (
                          <div
                            key={st.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSelectedStation(st.id);
                              setIsModified(true);
                            }}
                            className={`group relative p-2 rounded-lg border text-left text-xs transition-all flex flex-col justify-between cursor-pointer select-none ${
                              isSel
                                ? 'bg-turmeric-l/10 border-turmeric text-turmeric font-bold ring-1 ring-turmeric/30'
                                : 'bg-paper-3 border-line text-ink-3 hover:border-ink-3 hover:text-ink'
                            } ${isBeingDeleted ? 'opacity-40 pointer-events-none' : ''}`}
                          >
                            <div className="flex items-center justify-between mb-1 gap-1">
                              <span className="font-mono text-[10px] uppercase font-bold">{st.code}</span>
                              <div className="flex items-center gap-1">
                                {/* Hover Edit & Delete ("during mouse touching time") */}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                  <button
                                    type="button"
                                    title="Edit station"
                                    onClick={(e) => handleStartEditStation(st, e)}
                                    className="p-0.5 px-1 rounded bg-paper border border-line text-[10px] hover:text-turmeric hover:border-turmeric cursor-pointer"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    title="Delete station"
                                    onClick={(e) => promptDeleteStation(st, e)}
                                    className="p-0.5 px-1 rounded bg-paper border border-line text-[10px] hover:text-red-500 hover:border-red-400 cursor-pointer"
                                  >
                                    🗑️
                                  </button>
                                </div>
                                {isSel && (
                                  <span className="text-[10px] text-turmeric font-bold">✓</span>
                                )}
                              </div>
                            </div>
                            <span className="truncate text-ink font-semibold">{st.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="border-t border-line/50 pt-4 space-y-3">
                  <span className="block text-xs font-bold text-ink-2 uppercase tracking-wide">Branch-Level Access Mapping</span>
                  <div className="space-y-1.5">
                    {BRANCH_OPTIONS.map((b) => (
                      <label 
                        key={b.id} 
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                          branchAccess.includes(b.id)
                            ? 'bg-turmeric-l/10 border-turmeric text-turmeric font-bold'
                            : 'bg-paper-3 border-line text-ink-3 hover:border-ink-3'
                        }`}
                      >
                        <span className="font-semibold">{b.name}</span>
                        <input
                          type="checkbox"
                          checked={branchAccess.includes(b.id)}
                          onChange={() => handleToggleBranch(b.id)}
                          className="accent-turmeric"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Data Access Restrictions */}
              <div className="card p-5 space-y-3" style={{ background: 'var(--paper-1)' }}>
                <span className="block text-xs font-bold text-ink-2 uppercase tracking-wide">Data Access Restrictions</span>
                <div className="space-y-1.5">
                  {DATA_RESTRICTION_OPTIONS.map((opt) => (
                    <label 
                      key={opt.key}
                      className="flex items-center gap-2 text-xs p-1 cursor-pointer select-none text-ink-2 hover:text-ink"
                    >
                      <input 
                        type="checkbox" 
                        checked={dataRestrictions.includes(opt.key)}
                        onChange={() => handleToggleDataRestriction(opt.key)}
                        className="accent-turmeric rounded"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Accordion Permission Matrix Grid */}
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3" style={{ background: 'var(--paper-1)' }}>
                <div className="w-full md:w-auto">
                  <input
                    type="text"
                    value={permissionFilter}
                    onChange={(e) => setPermissionFilter(e.target.value)}
                    placeholder="🔍 Search specific permission rule..."
                    className="px-3 py-1.5 rounded bg-paper-3 border border-line text-xs w-full md:w-64 font-mono focus:outline-none focus:border-turmeric"
                  />
                </div>
                <div className="flex gap-2 flex-wrap text-xs">
                  <button 
                    onClick={() => handleBulkPermissions('select-all')}
                    className="px-2.5 py-1.5 rounded bg-paper-3 border border-line hover:bg-line transition-all"
                  >
                    Select All
                  </button>
                  <button 
                    onClick={() => handleBulkPermissions('clear-all')}
                    className="px-2.5 py-1.5 rounded bg-paper-3 border border-line hover:bg-line transition-all text-red-500"
                  >
                    Clear All
                  </button>
                  <button 
                    onClick={() => setExpandedCategories(PERMISSION_MODULES.map(c => c.category))}
                    className="px-2.5 py-1.5 rounded bg-paper-3 border border-line hover:bg-line transition-all"
                  >
                    Expand All
                  </button>
                  <button 
                    onClick={() => setExpandedCategories([])}
                    className="px-2.5 py-1.5 rounded bg-paper-3 border border-line hover:bg-line transition-all"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {/* Collapsible module groups */}
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {PERMISSION_MODULES.map((cat) => {
                  // Filter permissions
                  const matches = cat.permissions.filter(p => 
                    p.label.toLowerCase().includes(permissionFilter.toLowerCase()) ||
                    p.key.toLowerCase().includes(permissionFilter.toLowerCase())
                  );

                  if (matches.length === 0) return null;

                  const isExpanded = expandedCategories.includes(cat.category);
                  const activeCount = matches.filter(p => 
                    p.actions.some(act => customPermissions.includes(`${p.key}:${act}`))
                  ).length;

                  return (
                    <div key={cat.category} className="card overflow-hidden border-line" style={{ background: 'var(--paper-1)' }}>
                      <div 
                        onClick={() => toggleAccordion(cat.category)}
                        className="p-3.5 flex justify-between items-center cursor-pointer select-none bg-paper-3/40 border-b border-line hover:bg-paper-3/80 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-ink">{cat.category}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-paper-3 font-mono text-ink-3">
                            {activeCount} / {matches.length} active
                          </span>
                        </div>
                        <span className={`text-xs text-ink-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="p-3 space-y-2">
                          {matches.map((p) => (
                            <div key={p.key} className="flex flex-col md:flex-row md:items-center justify-between p-2 rounded hover:bg-paper-3/20 transition-all border border-transparent hover:border-line/20 gap-2">
                              <div>
                                <span className="text-xs font-semibold block text-ink">{p.label}</span>
                                <span className="text-[10px] font-mono text-ink-3">{p.key}</span>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                {p.actions.map(act => {
                                  const fullKey = `${p.key}:${act}`;
                                  const checked = customPermissions.includes(fullKey);
                                  const isOverriddenVal = isOverridden(p.key, act);

                                  return (
                                    <label 
                                      key={act}
                                      className={`flex items-center gap-1 text-[10px] border px-2 py-0.5 rounded cursor-pointer select-none font-mono transition-all ${
                                        checked 
                                          ? 'bg-turmeric/10 border-turmeric text-turmeric font-bold'
                                          : 'bg-paper-3/30 border-line text-ink-3'
                                      } ${isOverriddenVal ? 'ring-1 ring-gold ring-offset-1' : ''}`}
                                    >
                                      <input 
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => handleTogglePermission(p.key, act)}
                                        className="accent-turmeric h-3 w-3"
                                      />
                                      <span className="capitalize">{act}</span>
                                      {isOverriddenVal && <span className="text-[7px] bg-gold text-[#2A1607] px-0.5 rounded font-sans font-bold">Custom</span>}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Sticky Action Bar */}
              <div className={`card p-4 flex justify-between items-center border transition-all ${
                isModified ? 'border-turmeric bg-turmeric-l/5' : 'border-line bg-paper-1'
              }`}>
                <div className="flex items-center gap-2">
                  {isModified ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-gold animate-pulse shrink-0" />
                      <span className="text-xs font-bold text-gold">Unsaved Permission Overrides Detected</span>
                    </>
                  ) : (
                    <span className="text-xs text-ink-3">Permissions in Sync with active employee database.</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {isModified && (
                    <button 
                      onClick={() => selectStaffMember(selectedStaff)}
                      className="px-3 py-1.5 rounded hover:bg-line text-xs font-semibold transition-all"
                    >
                      Reset Changes
                    </button>
                  )}
                  <button
                    disabled={isSaving}
                    onClick={handleSavePermissions}
                    className={`px-4 py-2 rounded font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      isModified 
                        ? 'bg-turmeric text-[#2A1607] hover:brightness-110 active:scale-95' 
                        : 'bg-paper-3 text-ink-3 cursor-not-allowed border border-line'
                    }`}
                  >
                    {isSaving ? 'Pushing Sessions...' : 'Commit & Sync'}
                  </button>
                </div>
              </div>

              {/* Save Alert Messages */}
              {saveMessage && (
                <div className="p-3.5 rounded-lg border border-green-500/20 bg-green-500/10 text-green-500 text-xs font-mono">
                  ✅ {saveMessage}
                </div>
              )}
              {errorMessage && (
                <div className="p-3.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 text-xs font-mono">
                  ⚠️ {errorMessage}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CREATE STAFF MODAL */}
      {showAddModal && (
        <div 
          onClick={() => setShowAddModal(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-paper-3 border border-line rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-line pb-3 mb-5">
              <div>
                <h3 className="font-bold text-lg">Add New Staff Member</h3>
                <p className="text-xs text-ink-3 mt-0.5">Fill required fields and set role — permissions can be tuned after.</p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-ink-3 hover:text-ink transition-all flex-shrink-0 ml-4"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Error alerts */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold font-mono">
                ⚠️ Error: {errorMessage}
              </div>
            )}

            {/* Form body */}
            <form onSubmit={handleCreateStaff} className="space-y-5">

              {/* ── SECTION 1: Basic Info ── */}
              <div>
                <span className="block text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-3">Basic Information</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-ink-2">Full Name *</label>
                    <input 
                      type="text" 
                      required
                      value={newStaffName} 
                      onChange={(e) => setNewStaffName(e.target.value)}
                      placeholder="Staff member full name"
                      className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-sm focus:outline-none focus:border-turmeric"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-ink-2">Employee ID Code</label>
                    <input 
                      type="text" 
                      value={newStaffCode} 
                      onChange={(e) => setNewStaffCode(e.target.value)}
                      placeholder="e.g. ST-01"
                      className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-sm focus:outline-none focus:border-turmeric"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-ink-2">Phone Number</label>
                    <input 
                      type="tel" 
                      value={newStaffPhone} 
                      onChange={(e) => setNewStaffPhone(e.target.value)}
                      placeholder="10-digit phone number"
                      className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-sm focus:outline-none focus:border-turmeric"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-ink-2">Login PIN <span className="font-normal text-ink-3">(4–6 digits, POS access)</span></label>
                    <input 
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={newStaffPin} 
                      onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • •"
                      className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-sm focus:outline-none focus:border-turmeric tracking-widest"
                    />
                  </div>
                </div>
              </div>

              {/* ── SECTION 2: Role ── */}
              <div className="border-t border-line/50 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="block text-[10px] font-bold text-ink-3 uppercase tracking-widest">Role *</span>
                  <button
                    type="button"
                    onClick={() => setShowNewRoleInput(!showNewRoleInput)}
                    className="text-xs font-semibold text-turmeric hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ Add Custom Role</span>
                  </button>
                </div>

                {/* Inline Add Custom Role Form */}
                {showNewRoleInput && (
                  <div className="p-3 mb-3 rounded-xl border border-turmeric/40 bg-turmeric-l/5 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">Create Re-usable Custom Role</span>
                      <button
                        type="button"
                        onClick={() => setShowNewRoleInput(false)}
                        className="text-ink-3 hover:text-ink text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-ink-3 mb-1">Custom Role Name *</label>
                        <input
                          type="text"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          placeholder="e.g. Floor Captain"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-paper-3 border border-line text-xs text-ink focus:outline-none focus:border-turmeric"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-ink-3 mb-1">Base System Access</label>
                        <select
                          value={newRoleBase}
                          onChange={(e) => setNewRoleBase(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-paper-3 border border-line text-xs text-ink focus:outline-none focus:border-turmeric cursor-pointer"
                        >
                          <option value="none">None (No System Access)</option>
                          <option value="waiter">Waiter (POS & Floor Orders)</option>
                          <option value="cashier">Cashier (Billing & Till)</option>
                          <option value="kitchen">Kitchen (KDS & Station)</option>
                          <option value="manager">Administrator (Manager)</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={isCreatingRole || !newRoleName.trim()}
                        onClick={handleCreateCustomRole}
                        className="px-3 py-1.5 rounded-lg bg-turmeric text-[#2A1607] font-bold text-xs hover:brightness-110 active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {isCreatingRole ? 'Saving...' : 'Save & Select Role'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {[
                    ...ALL_ROLES.map(r => ({ id: r, label: ROLE_LABELS[r] })),
                    ...customRoles.map(cr => ({ id: cr.name, label: cr.name, isCustom: true }))
                  ].map((r) => {
                    const isSelected = newStaffRole.toLowerCase() === r.id.toLowerCase();
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setNewStaffRole(r.id)}
                        className={`relative px-3 py-2.5 rounded-lg border text-xs font-semibold text-left transition-all ${
                          isSelected
                            ? 'border-turmeric bg-turmeric/10 text-turmeric'
                            : 'border-line bg-paper-2 text-ink-2 hover:border-ink-3 hover:text-ink'
                        }`}
                      >
                        <span className="block capitalize truncate">{r.label}</span>
                        {isSelected && (
                          <span className="absolute top-1.5 right-2 text-[9px] text-turmeric">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-ink-3 mt-2">
                  {ROLE_DESCRIPTIONS[newStaffRole as StaffRole] || 
                   (customRoles.find(cr => cr.name.toLowerCase() === newStaffRole.toLowerCase())
                     ? `Custom role based on ${customRoles.find(cr => cr.name.toLowerCase() === newStaffRole.toLowerCase())?.baseRole || 'waiter'}. Reusable across your team.`
                     : 'Point of sale and QR order approvals.')}
                </p>
              </div>

              {/* ── SECTION 2B: Waiter Floor Section / Station Arrangement (Only for Waiter) ── */}
              {(newStaffRole.toLowerCase() === 'waiter' ||
                customRoles.find((c) => c.name.toLowerCase() === newStaffRole.toLowerCase())?.baseRole === 'waiter') && (
                <div className="border-t border-line/50 pt-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center mb-2.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">📍</span>
                        <span className="block text-[10px] font-bold text-turmeric uppercase tracking-widest">
                          Floor Section / Station Assignment *
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-3 mt-0.5">
                        Assign this waiter to a floor section. Orders taken by this waiter will automatically print to that station's printer.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (showNewStationInput && !editingStationId) {
                          handleCancelStationForm();
                        } else {
                          setEditingStationId(null);
                          setNewStationCode('');
                          setNewStationName('');
                          setShowNewStationInput(true);
                        }
                      }}
                      className="text-xs font-semibold text-turmeric hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-3"
                    >
                      <span>+ Add Custom Station</span>
                    </button>
                  </div>

                  {/* Inline Add/Edit Custom Station Form */}
                  {showNewStationInput && (
                    <div className="p-3 mb-3 rounded-xl border border-turmeric/40 bg-turmeric-l/5 space-y-2.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-ink">
                          {editingStationId ? `Edit Floor Station (${newStationCode || 'Station'})` : 'Add Custom Floor Station'}
                        </span>
                        <button
                          type="button"
                          onClick={handleCancelStationForm}
                          className="text-ink-3 hover:text-ink text-xs p-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-ink-3 mb-1">Station Code * (e.g. P1, P2)</label>
                          <input
                            type="text"
                            value={newStationCode}
                            onChange={(e) => setNewStationCode(e.target.value)}
                            placeholder="e.g. P1"
                            maxLength={8}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-paper-3 border border-line text-xs text-ink uppercase font-bold focus:outline-none focus:border-turmeric"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-ink-3 mb-1">Section Name * (e.g. Terrace)</label>
                          <input
                            type="text"
                            value={newStationName}
                            onChange={(e) => setNewStationName(e.target.value)}
                            placeholder="e.g. Terrace / Rooftop"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-paper-3 border border-line text-xs text-ink focus:outline-none focus:border-turmeric"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleCancelStationForm}
                          className="px-3 py-1.5 rounded-lg border border-line text-ink-3 hover:text-ink font-semibold text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isCreatingStation || !newStationName.trim()}
                          onClick={handleCreateCustomStation}
                          className="px-3 py-1.5 rounded-lg bg-turmeric text-[#2A1607] font-bold text-xs hover:brightness-110 active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {isCreatingStation ? 'Saving…' : (editingStationId ? 'Update Station' : 'Save & Select Station')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Station Selector Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {waiterStations.map((st) => {
                      const isSel = selectedStation.toLowerCase() === st.id.toLowerCase();
                      const isBeingDeleted = isDeletingStation && stationToDelete?.id === st.id;
                      return (
                        <div
                          key={st.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedStation(st.id)}
                          className={`group relative p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer select-none ${
                            isSel
                              ? 'border-turmeric bg-turmeric/10 text-ink ring-2 ring-turmeric/30'
                              : 'border-line bg-paper-2 text-ink-2 hover:border-ink-3 hover:text-ink'
                          } ${isBeingDeleted ? 'opacity-40 pointer-events-none' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-1 gap-1">
                            <span className="font-mono text-xs font-black uppercase px-2 py-0.5 rounded bg-turmeric/20 text-turmeric-d border border-turmeric/30">
                              {st.code}
                            </span>
                            <div className="flex items-center gap-1">
                              {/* Hover Edit & Delete ("during mouse touching time") */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                <button
                                  type="button"
                                  title="Edit station"
                                  onClick={(e) => handleStartEditStation(st, e)}
                                  className="p-1 rounded bg-paper border border-line text-[11px] hover:text-turmeric hover:border-turmeric shadow-xs transition-colors cursor-pointer"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  title="Delete station"
                                  onClick={(e) => promptDeleteStation(st, e)}
                                  className="p-1 rounded bg-paper border border-line text-[11px] hover:text-red-500 hover:border-red-400 shadow-xs transition-colors cursor-pointer"
                                >
                                  🗑️
                                </button>
                              </div>
                              {isSel && (
                                <span className="text-xs text-turmeric font-bold ml-0.5">✓</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <b className="text-xs block font-bold text-ink truncate">{st.name}</b>
                            <span className="text-[10px] text-ink-3 block truncate">{st.desc || st.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── SECTION 3: Payment (Optional) ── */}
              <div className="border-t border-line/50 pt-4">
                <span className="block text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-3">Payment <span className="normal-case font-normal">(Optional)</span></span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-ink-2">Pay Type</label>
                    <div className="flex gap-2">
                      {(['monthly', 'hourly'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewStaffPayType(prev => prev === t ? '' : t)}
                          className={`flex-1 py-2 rounded-lg border text-xs font-semibold capitalize transition-all ${
                            newStaffPayType === t
                              ? 'border-turmeric bg-turmeric/10 text-turmeric'
                              : 'border-line bg-paper-2 text-ink-2 hover:border-ink-3 hover:text-ink'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-ink-2">
                      Rate (₹){newStaffPayType === 'monthly' ? ' / month' : newStaffPayType === 'hourly' ? ' / hr' : ''}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-xs font-bold">₹</span>
                      <input 
                        type="number"
                        min="0"
                        step="0.01"
                        value={newStaffPayRate} 
                        onChange={(e) => setNewStaffPayRate(e.target.value)}
                        placeholder={newStaffPayType === 'hourly' ? '150.00' : '20000'}
                        disabled={!newStaffPayType}
                        className="w-full pl-7 pr-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-sm focus:outline-none focus:border-turmeric disabled:opacity-40"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SECTION 4: Login Credentials ── */}
              <div className="border-t border-line/50 pt-4">
                <span className="block text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-1">Dashboard Login Credentials *</span>
                <p className="text-[10px] text-ink-3 mb-3">Required for dashboard access. The username must be unique across your team.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-ink-2">Email / Username *</label>
                    <input 
                      type="text" 
                      required
                      value={newStaffEmail} 
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      placeholder="username"
                      className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-sm focus:outline-none focus:border-turmeric"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-ink-2">Dashboard Password *</label>
                    <input 
                      type="password" 
                      required
                      minLength={6}
                      value={newStaffPassword} 
                      onChange={(e) => setNewStaffPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-sm focus:outline-none focus:border-turmeric"
                    />
                  </div>
                </div>
              </div>

              {/* ── SECTION 5: Other Details (Optional) ── */}
              <div className="border-t border-line/50 pt-4">
                <span className="block text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-3">Other Details <span className="normal-case font-normal">(Optional)</span></span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-ink-2">Designation / Title</label>
                    <input 
                      type="text" 
                      value={newStaffDesignation} 
                      onChange={(e) => setNewStaffDesignation(e.target.value)}
                      placeholder="e.g. Head Waiter"
                      className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-sm focus:outline-none focus:border-turmeric"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-ink-2">Joining Date</label>
                    <input 
                      type="date" 
                      value={newStaffJoiningDate} 
                      onChange={(e) => setNewStaffJoiningDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-paper-2 border border-line text-ink text-sm focus:outline-none focus:border-turmeric"
                    />
                  </div>
                </div>
              </div>

              {/* ── Actions ── */}
              <div className="flex justify-end gap-2 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-paper-2 hover:bg-line text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-turmeric text-[#2A1607] font-bold text-xs hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  Create & Setup RBAC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Standard Delete Station Confirmation Modal */}
      {stationToDelete && (
        <div
          onClick={() => !isDeletingStation && setStationToDelete(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-transparent animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-paper border border-line rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-150 ring-1 ring-black/5"
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 mx-auto flex items-center justify-center text-xl mb-3.5">
              🗑️
            </div>
            <h4 className="text-base font-bold text-ink mb-1.5">Delete Floor Station</h4>
            <p className="text-xs text-ink-3 leading-relaxed mb-5">
              Are you sure you want to delete station <b className="text-ink">{stationToDelete.code} ({stationToDelete.name})</b>?
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                disabled={isDeletingStation}
                onClick={() => setStationToDelete(null)}
                className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-ink-2 hover:bg-paper-2 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingStation}
                onClick={handleConfirmDeleteStation}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeletingStation ? 'Deleting…' : 'Yes, Delete Station'}
              </button>
            </div>
          </div>
        </div>
      )}

      {staffToDelete && (
        <div
          onClick={() => !isDeletingStaff && setStaffToDelete(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-transparent animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-paper border border-line rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-150 ring-1 ring-black/5"
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 mx-auto flex items-center justify-center text-xl mb-3.5">
              🗑️
            </div>
            <h4 className="text-base font-bold text-ink mb-1.5">Delete Staff Account</h4>
            <p className="text-xs text-ink-3 leading-relaxed mb-5">
              Are you sure you want to remove <b className="text-ink">{staffToDelete.name}</b> ({staffToDelete.role})? Historical sales and orders will be safely preserved.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                disabled={isDeletingStaff}
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-ink-2 hover:bg-paper-2 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingStaff}
                onClick={handleConfirmDeleteStaff}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeletingStaff ? 'Deleting…' : 'Yes, Delete Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
