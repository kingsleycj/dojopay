"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import axios from "axios";
import { BACKEND_URL } from "@/utils";
import { Appbar } from "@/components/Appbar";
import { WorkerSidebar } from "@/components/WorkerSidebar";
import { WorkerDashboardContent } from "@/components/worker/WorkerDashboardContent";
import { ApplicationFooter } from "@/components/ApplicationFooter";
import { ToastContainer } from "@/components/Toast";
import { WalletDisconnectButton, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { lamportsToSol } from "@/utils/convert";

// Create a custom Appbar wrapper for worker pages
const WorkerAppbar = ({ onUserTypeSelect, onMobileMenuToggle, mobileMenuOpen }: {
    onUserTypeSelect: (type: "worker" | "creator") => void;
    onMobileMenuToggle: () => void;
    mobileMenuOpen: boolean;
}) => {
    const { publicKey } = useWallet();
    const [workerEarnings, setWorkerEarnings] = useState<{ pendingAmount: string; lockedAmount: string } | null>(null);
    const [withdrawing, setWithdrawing] = useState(false);

    useEffect(() => {
        const fetchWorkerBalance = async () => {
            try {
                const token = localStorage.getItem("workerToken");
                if (!token || !publicKey) return;

                const response = await axios.get(`${BACKEND_URL}/v1/worker/balance`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                setWorkerEarnings(response.data);
            } catch (error) {
                console.error("Error fetching worker balance:", error);
            }
        };

        fetchWorkerBalance();
    }, [publicKey]);

    return (
        <>
            <div className="flex justify-between items-center border-b pb-2 pt-2 fixed top-0 left-0 right-0 bg-white z-50 w-screen">
                <div className="flex items-center flex-1 min-w-0">
                    {/* Hamburger menu for mobile */}
                    <button
                        onClick={onMobileMenuToggle}
                        className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex-shrink-0"
                    >
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {mobileMenuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                    <div className="text-base sm:text-lg lg:text-xl xl:text-2xl pl-2 sm:pl-4 flex-1 font-bold tracking-tight text-gray-900 truncate">
                        DojoPay
                    </div>
                </div>
                <div className="flex items-center pr-2 sm:pr-4 gap-2 sm:gap-3">
                    {/* Worker earnings display */}
                    {workerEarnings && (
                        <div className="flex items-center gap-2 bg-green-50 px-2 py-1 rounded-lg border border-green-200">
                            <div className="text-xs sm:text-sm">
                                <div className="font-semibold text-green-800">
                                    {lamportsToSol(workerEarnings.pendingAmount)} SOL
                                </div>
                                <div className="text-xs text-green-600">
                                    Available
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Wallet button */}
                    {publicKey ? <WalletDisconnectButton /> : <WalletMultiButton />}
                </div>
            </div>
        </>
    );
};

export default function WorkerDashboardPage() {
    const { publicKey, connected } = useWallet();
    const router = useRouter();
    const [userType, setUserType] = useState<'worker' | null>(null);
    const [loading, setLoading] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

    const handleMobileMenuToggle = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    const handleMobileMenuClose = () => {
        setMobileMenuOpen(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col">
                <ToastContainer />
                <WorkerAppbar onUserTypeSelect={handleUserTypeSelect} onMobileMenuToggle={handleMobileMenuToggle} mobileMenuOpen={mobileMenuOpen} />
                <div className="flex-grow pt-16">
                    <div className="flex flex-col lg:flex-row">
                        <WorkerSidebar activeView="dashboard" mobileMenuOpen={mobileMenuOpen} onMobileMenuClose={handleMobileMenuClose} />
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
                <WorkerAppbar onUserTypeSelect={handleUserTypeSelect} onMobileMenuToggle={handleMobileMenuToggle} mobileMenuOpen={mobileMenuOpen} />
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
            <WorkerAppbar onUserTypeSelect={handleUserTypeSelect} onMobileMenuToggle={handleMobileMenuToggle} mobileMenuOpen={mobileMenuOpen} />
            <div className="flex-grow pt-16">
                <div className="flex flex-col lg:flex-row">
                    <WorkerSidebar activeView="dashboard" mobileMenuOpen={mobileMenuOpen} onMobileMenuClose={handleMobileMenuClose} />
                    <div className="flex-grow lg:ml-64">
                        <WorkerDashboardContent />
                    </div>
                </div>
            </div>
            <ApplicationFooter />
        </div>
    );
}
