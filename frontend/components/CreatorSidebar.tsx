'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface CreatorSidebarProps {
    activeView?: 'dashboard' | 'home' | 'tasks';
    onViewChange?: (view: 'dashboard' | 'home' | 'tasks') => void;
}

export const CreatorSidebar = ({ activeView, onViewChange }: CreatorSidebarProps) => {
    const pathname = usePathname();
    
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
        }
    ];

    return (
        <div className="w-64 bg-white border-r border-gray-200 fixed top-16 left-0 bottom-0 z-30">
            <div className="p-6 pt-4 h-full overflow-y-auto">
                {/* Navigation Menu */}
                <nav className="space-y-2">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href || 
                            (item.id === 'tasks' && pathname.startsWith('/creator/task/'));
                        return (
                            <Link
                                key={item.id}
                                href={item.href}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                    isActive
                                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                                }`}
                            >
                                {item.icon}
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
};
