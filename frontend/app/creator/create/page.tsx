'use client';

import { Upload } from '@/components/Upload';
import { CreatorSidebar } from '@/components/CreatorSidebar';
import { Appbar } from '@/components/Appbar';
import { Footer } from '@/components/Footer';
import { ToastContainer } from '@/components/Toast';
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export default function CreatePage() {
    const { publicKey } = useWallet();
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
                    setUserType(null);
                }
            } else {
                setUserType(null);
            }
        };

        checkWalletConnection();
        const interval = setInterval(checkWalletConnection, 1000);
        return () => clearInterval(interval);
    }, [publicKey]);

    if (userType !== 'creator') {
        return (
            <div className="min-h-screen flex flex-col">
                <Appbar onUserTypeSelect={setUserType} />
                <div className="flex-grow flex justify-center pt-24">
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
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <ToastContainer />
            <Appbar onUserTypeSelect={setUserType} />
            <div className="flex flex-grow pt-16">
                <CreatorSidebar activeView="home" onViewChange={() => {}} />
                <div className="flex-grow ml-64">
                    <div className="max-w-4xl mx-auto p-8">
                        {/* Header Section */}
                        <div className="mb-8">
                            <div className="mb-2">
                                <h1 className="text-3xl font-bold text-gray-800">Create New Task</h1>
                            </div>
                            <p className="text-gray-600">Set up a new task for workers to complete and earn SOL</p>
                        </div>

                        {/* Main Content */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                            <Upload />
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
