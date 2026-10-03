'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface MonthCalendarPickerProps {
  selectedYear: number;
  selectedMonth: number; // 1-12
  onSelectMonthYear: (year: number, month: number, startDate: string, endDate: string) => void;
  customStartDate?: string;
  customEndDate?: string;
  onSelectCustomRange?: (start: string, end: string) => void;
  isCustomRange?: boolean;
  onToggleCustomRange?: (custom: boolean) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function MonthCalendarPicker({
  selectedYear,
  selectedMonth,
  onSelectMonthYear,
  customStartDate,
  customEndDate,
  onSelectCustomRange,
  isCustomRange = false,
  onToggleCustomRange,
}: MonthCalendarPickerProps) {
  const [viewYear, setViewYear] = useState<number>(selectedYear);
  const [viewMonth, setViewMonth] = useState<number>(selectedMonth); // 1-12
  const [showCalendar, setShowCalendar] = useState<boolean>(false);

  // Month bounds calculation: 100% accurate for February leap years
  // Month is 1-12, new Date(year, month, 0) gives the last day of month
  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth, 0).getDate();
  }, [viewYear, viewMonth]);

  // First day of month (0 = Sun, 1 = Mon, etc.)
  const firstDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth - 1, 1).getDay();
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
      applyMonth(viewYear - 1, 12);
    } else {
      setViewMonth(viewMonth - 1);
      applyMonth(viewYear, viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
      applyMonth(viewYear + 1, 1);
    } else {
      setViewMonth(viewMonth + 1);
      applyMonth(viewYear, viewMonth + 1);
    }
  };

  const applyMonth = (year: number, month: number) => {
    const days = new Date(year, month, 0).getDate();
    const mm = String(month).padStart(2, '0');
    const startStr = `${year}-${mm}-01`;
    const endStr = `${year}-${mm}-${String(days).padStart(2, '0')}`;
    onSelectMonthYear(year, month, startStr, endStr);
  };

  const handleSelectSpecificDay = (day: number) => {
    // If custom range toggle is available, user can pick start/end
    const mm = String(viewMonth).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${viewYear}-${mm}-${dd}`;
    if (isCustomRange && onSelectCustomRange) {
      if (!customStartDate || (customStartDate && customEndDate)) {
        onSelectCustomRange(dateStr, dateStr);
      } else {
        if (dateStr >= customStartDate) {
          onSelectCustomRange(customStartDate, dateStr);
        } else {
          onSelectCustomRange(dateStr, customStartDate);
        }
      }
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        {/* Month Selector Button */}
        <div className="flex items-center gap-1 rounded-xl p-1 border" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
            title="Previous Month"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            type="button"
            onClick={() => setShowCalendar(!showCalendar)}
            className="px-3 py-1 text-xs font-bold flex items-center gap-1.5 hover:text-amber-800 transition"
          >
            <CalendarIcon size={14} className="text-amber-600" />
            <span>{MONTH_NAMES[viewMonth - 1]} {viewYear}</span>
          </button>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
            title="Next Month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Toggle Custom Range Mode */}
        {onToggleCustomRange && (
          <button
            type="button"
            onClick={() => onToggleCustomRange(!isCustomRange)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
              isCustomRange ? 'bg-amber-600 text-white border-amber-600 font-bold' : 'hover:bg-amber-500/10'
            }`}
            style={!isCustomRange ? { background: 'var(--paper-2)', borderColor: 'var(--line)', color: 'var(--ink)' } : {}}
          >
            {isCustomRange ? 'Custom Range Active' : 'Custom Date Range'}
          </button>
        )}

        {/* Custom Date Inputs */}
        {isCustomRange && onSelectCustomRange && (
          <div className="flex items-center gap-1.5 text-xs">
            <input
              type="date"
              value={customStartDate || ''}
              onChange={(e) => onSelectCustomRange(e.target.value, customEndDate || e.target.value)}
              className="px-2 py-1.5 rounded-lg border text-xs"
              style={{ background: 'var(--paper-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
            />
            <span className="text-ink-3">→</span>
            <input
              type="date"
              value={customEndDate || ''}
              onChange={(e) => onSelectCustomRange(customStartDate || e.target.value, e.target.value)}
              className="px-2 py-1.5 rounded-lg border text-xs"
              style={{ background: 'var(--paper-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
            />
          </div>
        )}
      </div>

      {/* Popover Calendar Grid */}
      {showCalendar && (
        <div
          className="absolute z-50 mt-2 p-4 rounded-2xl border shadow-xl w-72"
          style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold">
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </span>
            <span className="text-[11px] font-mono text-ink-3">
              {daysInMonth} days
            </span>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
            {WEEKDAY_NAMES.map((d) => (
              <span key={d} className="text-[11px] font-semibold text-ink-3">
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-7 w-7" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const mm = String(viewMonth).padStart(2, '0');
              const dd = String(day).padStart(2, '0');
              const dateStr = `${viewYear}-${mm}-${dd}`;
              const isSelected =
                (isCustomRange && dateStr >= (customStartDate || '') && dateStr <= (customEndDate || '')) ||
                (!isCustomRange && viewYear === selectedYear && viewMonth === selectedMonth);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectSpecificDay(day)}
                  className={`h-7 w-7 rounded-lg text-xs font-mono transition flex items-center justify-center ${
                    isSelected
                      ? 'bg-amber-600 text-white font-bold'
                      : 'hover:bg-amber-500/15'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t flex justify-between items-center text-[11px]" style={{ borderColor: 'var(--line)' }}>
            <span className="text-ink-3">
              {viewMonth === 2 ? `${viewYear % 4 === 0 && (viewYear % 100 !== 0 || viewYear % 400 === 0) ? 'Leap Year (29d)' : 'Standard (28d)'}` : ''}
            </span>
            <button
              type="button"
              onClick={() => setShowCalendar(false)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-600 text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
