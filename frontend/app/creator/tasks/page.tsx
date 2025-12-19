'use client';

import { TasksView } from '@/components/TasksView';
import { CreatorSidebar } from '@/components/CreatorSidebar';
import { Appbar } from '@/components/Appbar';
import { Footer } from '@/components/Footer';
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';

export default function TasksPage() {
    const { publicKey } = useWallet();
    const router = useRouter();
    const [userType, setUserType] = useState<'worker' | 'creator' | null>(null);

    useEffect(() => {
        const checkWalletConnection = () => {
            if (publicKey) {
                const creatorToken = localStorage.getItem("token");
                const workerToken = localStorage.getItem("workerToken");
                
                if (creatorToken) {
                    setUserType('creator');
                } else if (workerToken) {
                    setUserType('worker');
                } else {
                    // Redirect to landing page if no tokens found
                    console.log("No tokens found, redirecting to landing page");
                    window.location.href = "/";
                }
            } else {
                setUserType(null);
            }
        };

        checkWalletConnection();
        const interval = setInterval(checkWalletConnection, 1000);
        return () => clearInterval(interval);
    }, [publicKey, router]);

    if (userType !== 'creator') {
        return (
            <div className="min-h-screen flex flex-col">
                <Appbar onUserTypeSelect={setUserType} />
                <div className="flex-grow pt-16 flex justify-center">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
                        <p className="text-gray-600">Please sign in as a creator to access this page.</p>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Appbar onUserTypeSelect={setUserType} />
            <div className="flex-grow pt-16">
                <div className="flex flex-col lg:flex-row">
                    <CreatorSidebar activeView="tasks" onViewChange={() => {}} />
                    <div className="flex-grow lg:ml-64">
                        <TasksView />
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
