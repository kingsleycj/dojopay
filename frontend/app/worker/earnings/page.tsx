"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import axios from "axios";
import { BACKEND_URL } from "@/utils";
import { Appbar } from "@/components/Appbar";
import { WorkerSidebar } from "@/components/WorkerSidebar";
import { WorkerEarningsContent } from "@/components/worker/WorkerEarningsContent";
import { ApplicationFooter } from "@/components/ApplicationFooter";
import { ToastContainer } from "@/components/Toast";

export default function WorkerEarningsPage() {
    const { publicKey, connected } = useWallet();
    const router = useRouter();
    const [userType, setUserType] = useState<'worker' | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            // Wait a moment for wallet to be ready on page load
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const workerToken = localStorage.getItem("workerToken");
            const creatorToken = localStorage.getItem("token");

            // If there's no worker token, redirect to home
            if (!workerToken) {
                router.push('/');
                return;
            }

            // If there's a creator token, redirect to creator dashboard
            if (creatorToken) {
                router.push('/creator/dashboard');
                return;
            }

            // If wallet is not connected after delay, try to wait for it
            if (!connected && !publicKey) {
                // Give wallet another moment to connect
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Still not connected, but we have worker token, show the page anyway
                // The wallet will connect automatically when ready
                setUserType('worker');
                setLoading(false);
                return;
            }

            // Wallet is connected, proceed
            setUserType('worker');
            setLoading(false);
        };

        checkAuth();
    }, [publicKey, connected, router]);

    useEffect(() => {
        if (!publicKey && userType === 'worker') {
            // Only clear tokens if wallet was previously connected and is now disconnected
            localStorage.removeItem("token");
            localStorage.removeItem("workerToken");
            router.push('/');
        }
    }, [publicKey, userType, router]);

    const handleUserTypeSelect = (type: "worker" | "creator") => {
        if (type === "creator") {
            router.push('/creator/dashboard');
        }
        // For worker type, we're already on the worker page
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col">
                <ToastContainer />
                <Appbar onUserTypeSelect={handleUserTypeSelect} />
                <div className="flex-grow pt-16">
                    <div className="flex flex-col lg:flex-row">
                        <WorkerSidebar activeView="earnings" />
                        <div className="flex-grow lg:ml-64">
                            {/* Empty content area - only sidebar shows loader */}
                        </div>
                    </div>
                </div>
                <ApplicationFooter />
            </div>
        );
    }

    if (userType !== 'worker') {
        return (
            <div className="min-h-screen flex flex-col">
                <Appbar onUserTypeSelect={handleUserTypeSelect} />
                <div className="flex-grow pt-16 flex justify-center items-center">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
                        <p className="text-gray-600">Please sign in as a worker to access this page.</p>
                    </div>
                </div>
                <ApplicationFooter />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <ToastContainer />
            <Appbar onUserTypeSelect={handleUserTypeSelect} />
            <div className="flex-grow pt-16">
                <div className="flex flex-col lg:flex-row">
                    <WorkerSidebar activeView="earnings" />
                    <div className="flex-grow lg:ml-64">
                        <WorkerEarningsContent />
                    </div>
                </div>
            </div>
            <ApplicationFooter />
        </div>
    );
}
