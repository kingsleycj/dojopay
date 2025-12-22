"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    userType: 'creator' | 'worker' | null;
}

export const MobileMenu = ({ isOpen, onClose, userType }: MobileMenuProps) => {
    const pathname = usePathname();
    const [navigating, setNavigating] = useState<string | null>(null);

    // Reset navigation state when pathname changes
    useEffect(() => {
        setNavigating(null);
    }, [pathname]);

    if (!isOpen) return null;

    const creatorMenuItems = [
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
            id: 'create',
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

    const workerMenuItems = [
        {
            id: 'tasks',
            label: 'Available Tasks',
            href: '/',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            )
        }
    ];

    const menuItems = userType === 'creator' ? creatorMenuItems : workerMenuItems;

    return (
        <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/50"
                onClick={onClose}
            />
            
            {/* Menu Panel */}
            <div className="fixed top-0 left-0 bottom-0 w-72 bg-black text-white shadow-2xl border-r border-gray-200">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div>
                        <h2 className="text-lg font-semibold text-white">DojoPay</h2>
                        <div className="text-xs text-gray-400 mt-0.5">Navigation</div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <nav className="p-4">
                    <div className="space-y-1">
                        {menuItems.map((item) => (
                            <Link
                                key={item.id}
                                href={item.href}
                                onClick={() => {
                                    setNavigating(item.id);
                                    onClose();
                                }}
                                className={`group flex items-center px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 transform ${
                                    pathname === item.href
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
                        ))}
                    </div>
                </nav>
            </div>
        </div>
    );
};
