"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WalletMultiButton, WalletDisconnectButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { Appbar } from "@/components/Appbar";
import { Hero } from "@/components/Hero";
import { Upload } from "@/components/Upload";
import { Footer } from "@/components/Footer";
import { WorkerView } from "@/components/WorkerView";
import { CreatorSidebar } from "@/components/CreatorSidebar";
import { DashboardView } from "@/components/DashboardView";
import { TasksView } from "@/components/TasksView";
import { ToastContainer, toast } from "react-toastify";

function App() {
    const { publicKey, signMessage } = useWallet();
    const router = useRouter();
    const [userType, setUserType] = useState<'worker' | 'creator' | null>(null);

    useEffect(() => {
        const checkWalletConnection = () => {
            if (publicKey) {
                const creatorToken = localStorage.getItem("token");
                const workerToken = localStorage.getItem("workerToken");
                
                if (creatorToken) {
                    setUserType('creator');
                    // Redirect to dashboard if on root page
                    if (window.location.pathname === '/') {
                        router.push('/creator/dashboard');
                    }
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
    }, [publicKey, router]);

    if (userType === 'worker') {
        return (
            <div className="min-h-screen flex flex-col">
                <Appbar onUserTypeSelect={setUserType} />
                <div className="flex-grow pt-16">
                    <WorkerView />
                </div>
                <Footer />
            </div>
        );
    }

    if (userType === 'creator') {
        // This will only show briefly before redirecting to /creator/dashboard
        return (
            <div className="min-h-screen flex flex-col">
                <Appbar onUserTypeSelect={setUserType} />
                <div className="flex-grow flex justify-center pt-24">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <ToastContainer />
            <Appbar onUserTypeSelect={setUserType} />
            <div className="flex-grow flex justify-center pt-24">
                <div className="max-w-screen-lg">
                    <Hero />
                    {userType === 'creator' && <Upload />}
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default App;
