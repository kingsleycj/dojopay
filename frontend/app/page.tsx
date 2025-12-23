"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WalletDisconnectButton, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import axios from "axios";
import { BACKEND_URL } from "@/utils";
import { Footer } from "@/components/landing/Footer";
import { Appbar } from "@/components/Appbar";
import { WorkerView } from "@/components/WorkerView";
import { ToastContainer } from "@/components/Toast";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { BuiltForEveryoneSection } from "@/components/landing/BuiltForEveryoneSection";
import { WhySolanaSection } from "@/components/landing/WhySolanaSection";
import { CTASection } from "@/components/landing/CTASection";
import { CredibilitySection } from "@/components/landing/CredibilitySection";
import { Navbar } from "@/components/landing/Navbar";

function App() {
    const { publicKey, signMessage } = useWallet();
    const router = useRouter();
    const [userType, setUserType] = useState<'worker' | 'creator' | null>(null);
    const [authOpen, setAuthOpen] = useState(false);
    const [authRole, setAuthRole] = useState<'creator' | 'worker' | null>(null);
    const [signingIn, setSigningIn] = useState(false);

    const walletAddress = useMemo(() => publicKey?.toString(), [publicKey]);

    async function signAndSendCreator(): Promise<boolean> {
        if (!publicKey) return false;
        if (localStorage.getItem("token")) return true;

        if (!signMessage) return false;

        setSigningIn(true);
        try {
            const message = new TextEncoder().encode("Sign into DojoPay as a creator");
            const signature = await signMessage(message);
            const response = await axios.post(`${BACKEND_URL}/v1/user/signin`, {
                signature,
                publicKey: publicKey.toString(),
            });
            localStorage.setItem("token", response.data.token);
            return true;
        } catch (error) {
            console.error("Backend signin failed:", error);
            return false;
        } finally {
            setSigningIn(false);
        }
    }

    async function signAndSendWorker(): Promise<boolean> {
        if (!publicKey) return false;
        if (localStorage.getItem("workerToken")) return true;

        if (!signMessage) return false;

        setSigningIn(true);
        try {
            const message = new TextEncoder().encode("Sign into DojoPay as a worker");
            const signature = await signMessage(message);
            const response = await axios.post(`${BACKEND_URL}/v1/worker/signin`, {
                signature,
                publicKey: publicKey.toString(),
            });
            localStorage.setItem("workerToken", response.data.token);
            return true;
        } catch (error) {
            console.error("Backend worker signin failed:", error);
            return false;
        } finally {
            setSigningIn(false);
        }
    }

    const openAuth = (role?: 'creator' | 'worker') => {
        setAuthOpen(true);
        setAuthRole(role ?? null);
    };

    const closeAuth = () => {
        if (signingIn) return;
        setAuthOpen(false);
        setAuthRole(null);
    };

    useEffect(() => {
        if (publicKey) {
            const creatorToken = localStorage.getItem("token");
            const workerToken = localStorage.getItem("workerToken");

            if (creatorToken) {
                setUserType('creator');
                if (window.location.pathname === '/') {
                    router.push('/creator/dashboard');
                }
            } else if (workerToken) {
                setUserType('worker');
                if (window.location.pathname === '/') {
                    router.push('/worker/dashboard');
                }
            } else {
                setUserType(null);
            }
        } else {
            setUserType(null);
        }
    }, [publicKey, router]);

    useEffect(() => {
        if (!publicKey) {
            localStorage.removeItem("token");
            localStorage.removeItem("workerToken");
        }
    }, [publicKey]);

    useEffect(() => {
        if (!authOpen) return;
        if (!authRole) return;
        if (!publicKey) return;
        if (signingIn) return;

        const run = async () => {
            const ok = authRole === 'worker' ? await signAndSendWorker() : await signAndSendCreator();
            if (!ok) return;

            setUserType(authRole);
            setAuthOpen(false);
            if (authRole === 'creator') {
                router.push('/creator/dashboard');
            } else {
                router.push('/worker/dashboard');
            }
        };

        void run();
    }, [authOpen, authRole, publicKey, signingIn, router]);

    useEffect(() => {
        if (userType === 'worker' && window.location.pathname === '/') {
            router.push('/worker/dashboard');
        }
    }, [userType, router]);

    if (userType === 'worker') {
        return (
        <div className="min-h-screen flex flex-col">
            <ToastContainer />
            <Appbar onUserTypeSelect={setUserType} />
            <div className="flex-grow pt-16 flex justify-center items-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f97316] mx-auto"></div>
                    <p className="mt-4 text-gray-600">Redirecting to worker dashboard...</p>
                </div>
            </div>
            <Footer />
        </div>
    );
    }

    if (userType === 'creator') {
        // This will only show briefly before redirecting to /creator/dashboard
        return (
            <div className="min-h-screen flex flex-col">
                <ToastContainer />
                <Appbar onUserTypeSelect={setUserType} />
                <div className="flex-grow pt-16 flex justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f97316] mx-auto"></div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <ToastContainer />
            <Navbar onGetStarted={() => openAuth()} />
            <div className="flex-grow">
                <HeroSection
                    onGetStarted={() => openAuth()}
                    onJoinAsWorker={() => openAuth('worker')}
                />
                <CredibilitySection />
                <HowItWorksSection />
                <BuiltForEveryoneSection />
                <WhySolanaSection />
                <CTASection />
            </div>
            <Footer />

            {authOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-6">
                        <div className="text-center mb-4">
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Welcome to DojoPay</h3>
                            <p className="text-gray-600 text-sm">Choose a role, then connect your wallet to sign in</p>
                        </div>

                        {!authRole ? (
                            <div className="grid sm:grid-cols-2 gap-4">
                                <button
                                    onClick={() => setAuthRole('creator')}
                                    className="rounded-xl border border-gray-200 hover:border-gray-900/20 hover:bg-gray-50 hover:-translate-y-0.5 transition-all p-4 text-left"
                                >
                                    <div className="text-lg font-semibold text-gray-900 mb-1">Creator</div>
                                    <div className="text-sm text-gray-600">Post tasks and manage payouts</div>
                                </button>
                                <button
                                    onClick={() => setAuthRole('worker')}
                                    className="rounded-xl border border-gray-200 hover:border-gray-900/20 hover:bg-gray-50 hover:-translate-y-0.5 transition-all p-4 text-left"
                                >
                                    <div className="text-lg font-semibold text-gray-900 mb-1">Worker</div>
                                    <div className="text-sm text-gray-600">Complete tasks and earn instantly</div>
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-xl border border-gray-200 p-4">
                                    <div className="text-sm font-semibold text-gray-900">Signing in as</div>
                                    <div className="text-sm text-gray-600 mt-1">{authRole}</div>
                                </div>

                                {!publicKey ? (
                                    <div className="rounded-xl border border-gray-200 p-4">
                                        <div className="text-sm text-gray-700 mb-3">Connect your wallet to continue</div>
                                        <div className="flex justify-center">
                                            <WalletMultiButton />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-gray-200 p-4">
                                        <div className="text-sm text-gray-700">Wallet connected</div>
                                        <div className="text-xs text-gray-500 font-mono mt-1">{walletAddress}</div>
                                        <div className="mt-3 flex justify-center">
                                            <WalletDisconnectButton />
                                        </div>
                                    </div>
                                )}

                                {signingIn && (
                                    <div className="flex justify-center py-2">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f97316]" />
                                    </div>
                                )}

                                <div className="flex justify-between gap-3">
                                    <button
                                        onClick={() => setAuthRole(null)}
                                        disabled={signingIn}
                                        className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-gray-300 disabled:opacity-50"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={closeAuth}
                                        disabled={signingIn}
                                        className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-black disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {!authRole && (
                            <div className="mt-5 flex justify-center">
                                <button
                                    onClick={closeAuth}
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
