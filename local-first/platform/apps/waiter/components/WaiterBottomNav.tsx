'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, UtensilsCrossed, ArrowLeftRight, Bell, User } from 'lucide-react';

interface WaiterBottomNavProps {
  unreadAlertsCount?: number;
}

export function WaiterBottomNav({ unreadAlertsCount = 0 }: WaiterBottomNavProps) {
  const pathname = usePathname();

  if (pathname === '/login') return null;

  const navItems = [
    { href: '/tables', label: 'Tables', icon: LayoutGrid },
    { href: '/transfers', label: 'Transfer/Merge', icon: ArrowLeftRight },
    {
      href: '/requests',
      label: 'Requests',
      icon: Bell,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : null,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav px-3 py-2 flex items-center justify-around">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/tables' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-col items-center justify-center py-1 px-4 rounded-xl transition-all duration-200 ${
              isActive
                ? 'text-sky-400 bg-sky-500/10 font-medium'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5 mb-0.5" />
              {item.badge ? (
                <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[11px] tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
