'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

interface CreatorSidebarProps {
    activeView?: 'dashboard' | 'home' | 'tasks' | 'create' | 'earnings';
    onViewChange?: (view: 'dashboard' | 'home' | 'tasks' | 'create' | 'earnings') => void;
}

export const CreatorSidebar = ({ activeView, onViewChange }: CreatorSidebarProps) => {
    const pathname = usePathname();
    const [navigating, setNavigating] = useState<string | null>(null);

    // Reset navigation state when pathname changes
    useEffect(() => {
        setNavigating(null);
    }, [pathname]);
    
    const menuItems = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            href: '/creator/dashboard',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            )
        },
        {
            id: 'home',
            label: 'Create Task',
            href: '/creator/create',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
            )
        },
        {
            id: 'tasks',
            label: 'Tasks',
            href: '/creator/tasks',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            )
        },
        {
            id: 'earnings',
            label: 'Earnings & Wallet',
            href: '/creator/earnings',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
            )
        }
    ];

    return (
        <div className="w-64 bg-black text-white border-r border-gray-200 fixed top-16 left-0 bottom-0 z-30 hidden lg:block">
            <div className="p-4 sm:p-6 pt-4 h-full overflow-y-auto">
                {/* Navigation Menu */}
                <nav className="space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href || (activeView && item.id === activeView);
                        return (
                            <Link
                                key={item.id}
                                href={item.href}
                                onClick={() => {
                                    setNavigating(item.id);
                                    onViewChange?.(item.id as any);
                                }}
                                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 transform ${
                                    isActive
                                        ? 'bg-[#f97316] text-black scale-105 shadow-lg'
                                        : navigating === item.id
                                        ? 'text-gray-200 bg-white/10 scale-95'
                                        : 'text-gray-300 hover:text-white hover:bg-white/5 hover:scale-105'
                                }`}
                            >
                                {navigating === item.id ? (
                                    <div className="w-5 h-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                                ) : (
                                    item.icon
                                )}
                                <span className="ml-3">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
};
