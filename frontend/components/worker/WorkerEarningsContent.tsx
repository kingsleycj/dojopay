"use client";

import { BACKEND_URL } from "@/utils";
import axios from "axios";
import { useEffect, useState } from "react";
import { showToast } from "@/components/Toast";
import { lamportsToSol, solToUsdSync, getSolPrice } from "@/utils/convert";
import { ExternalLink, Clock, CheckCircle, DollarSign, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

interface EarningRecord {
    id: number;
    amount: string;
    date: string;
    status: 'pending' | 'paid' | 'withdrawn';
    transactionHash?: string;
    taskId?: number;
    taskTitle?: string;
}

interface WorkerEarningsProps {
    onBack?: () => void;
}

export const WorkerEarningsContent = ({ onBack }: WorkerEarningsProps) => {
    const [earnings, setEarnings] = useState<EarningRecord[]>([]);
    const [metrics, setMetrics] = useState<{ pendingEarnings: string; totalEarned: string }>({ pendingEarnings: "0", totalEarned: "0" });
    const [loading, setLoading] = useState(true);
    const [withdrawing, setWithdrawing] = useState(false);
    const [solPriceFetched, setSolPriceFetched] = useState(false);
    const [pagination, setPagination] = useState<{
        currentPage: number;
        itemsPerPage: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    }>({
        currentPage: 1,
        itemsPerPage: 4,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
    });

    const handleWithdrawal = async () => {
        try {
            setWithdrawing(true);
            const token = localStorage.getItem("workerToken");
            if (!token) {
                showToast("Please sign in to withdraw", "error");
                return;
            }

            const response = await axios.post(`${BACKEND_URL}/v1/worker/payout`, {}, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            showToast(response.data.message || "Withdrawal successful!", "success");
            
            await fetchEarnings(pagination.currentPage);
        } catch (error: any) {
            console.error("Withdrawal error:", error);
            if (error.response?.data?.message) {
                showToast(error.response.data.message, "error");
            } else {
                showToast("Withdrawal failed. Please try again.", "error");
            }
        } finally {
            setWithdrawing(false);
        }
    };

    const fetchEarnings = async (page: number = 1) => {
        try {
            setLoading(true);
            const token = localStorage.getItem("workerToken");
            if (!token) return;

            const response = await axios.get(`${BACKEND_URL}/v1/worker/earnings`, {
                headers: { "Authorization": `Bearer ${token}` },
                params: { page, limit: 4 }
            });

            const { metrics, earnings, pagination: paginationData } = response.data;

            setEarnings(earnings);
            setMetrics(metrics);
            setPagination(paginationData);
        } catch (error: any) {
            console.error("Error fetching earnings:", error);
            if (error.response?.status === 401 || error.response?.status === 403) {
                localStorage.removeItem("workerToken");
                window.location.href = "/";
            } else {
                setEarnings([]);
                setMetrics({ pendingEarnings: "0", totalEarned: "0" });
                setPagination({
                    currentPage: 1,
                    itemsPerPage: 4,
                    totalItems: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fetch SOL price for USD conversions
        getSolPrice().then(() => {
            setSolPriceFetched(true);
        }).catch(error => {
            console.error('Failed to fetch SOL price:', error);
            setSolPriceFetched(true); // Still mark as fetched to use fallback
        });
        
        fetchEarnings();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                    </span>
                );
            case 'paid':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Paid
                    </span>
                );
            case 'withdrawn':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <DollarSign className="h-3 w-3 mr-1" />
                        Withdrawn
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {status}
                    </span>
                );
        }
    };

    const openSolanaExplorer = (txHash: string) => {
        window.open(`https://explorer.solana.com/tx/${txHash}?cluster=devnet`, '_blank');
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col gap-3 mb-6">
                    <div>
                        <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">Worker</div>
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Earnings & Withdrawals</h1>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">Track your earnings and withdrawal history.</p>
                    </div>
                </div>
                
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                        <div className="h-6 bg-gray-200 rounded w-32"></div>
                    </div>
                    <div className="divide-y divide-gray-200">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="p-4 animate-pulse">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                                        <div className="h-3 bg-gray-200 rounded w-48"></div>
                                    </div>
                                    <div className="h-6 bg-gray-200 rounded w-20 ml-4"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
            <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="flex items-center text-gray-600 hover:text-gray-900 mr-4 transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </button>
                        )}
                        <div>
                            <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">Worker</div>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Earnings & Withdrawals</h1>
                            <p className="text-xs sm:text-sm text-gray-600 mt-1">Track your earnings and withdrawal history.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-xs sm:text-sm font-medium text-gray-900">Available Balance</div>
                            <div className="text-lg sm:text-xl font-bold text-gray-900">
                                {lamportsToSol(metrics.pendingEarnings)} SOL
                            </div>
                            <div className="text-xs text-green-600 font-medium">
                                ${solToUsdSync(lamportsToSol(metrics.pendingEarnings))} USD
                            </div>
                        </div>
                        <button
                            onClick={handleWithdrawal}
                            disabled={withdrawing}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            <DollarSign className="h-4 w-4" />
                            {withdrawing ? 'Withdrawing...' : 'Withdraw'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                    <h3 className="text-lg font-medium text-gray-900">Transaction History</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Complete record of your task earnings and withdrawals
                    </p>
                </div>

                {earnings.length === 0 && pagination.currentPage === 1 && pagination.totalItems === 0 ? (
                    <div className="text-center py-12">
                        <div className="bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                            <DollarSign className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No earnings yet</h3>
                        <p className="text-sm text-gray-500">Complete tasks to see your earnings history here</p>
                    </div>
                ) : (
                    <>
                    {earnings.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                <DollarSign className="h-8 w-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No earnings on this page</h3>
                            <p className="text-sm text-gray-500">Try navigating to a different page</p>
                        </div>
                    ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Amount
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Task
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Transaction
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {earnings.map((earning) => (
                                    <tr key={earning.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {lamportsToSol(earning.amount)} SOL
                                            </div>
                                            <div className="text-xs text-green-600 font-medium">
                                                ${solToUsdSync(lamportsToSol(earning.amount))} USD
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {new Date(earning.date).toLocaleDateString()}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(earning.date).toLocaleTimeString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {earning.status === 'withdrawn' ? 'Withdrawal' : earning.taskTitle || 'Task Payment'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(earning.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {earning.transactionHash ? (
                                                <button
                                                    onClick={() => openSolanaExplorer(earning.transactionHash!)}
                                                    className="text-[#f97316] hover:text-[#ea580c] font-medium flex items-center"
                                                >
                                                    View on Solana
                                                    <ExternalLink className="h-3 w-3 ml-1" />
                                                </button>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    )}
                    
                    {pagination.totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                    Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of {pagination.totalItems} results
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => fetchEarnings(pagination.currentPage - 1)}
                                        disabled={!pagination.hasPreviousPage}
                                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Previous
                                    </button>
                                    <span className="px-3 py-1 text-sm text-gray-700">
                                        Page {pagination.currentPage} of {pagination.totalPages}
                                    </span>
                                    <button
                                        onClick={() => fetchEarnings(pagination.currentPage + 1)}
                                        disabled={!pagination.hasNextPage}
                                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    </>
                )}
            </div>

            {earnings.length > 0 && (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Earned</div>
                        <div className="mt-1 text-2xl font-bold text-gray-900">
                            {lamportsToSol(metrics.totalEarned)} SOL
                        </div>
                        <div className="text-xs text-green-600 font-medium">
                            ${solToUsdSync(lamportsToSol(metrics.totalEarned))} USD
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</div>
                        <div className="mt-1 text-2xl font-bold text-gray-900">
                            {lamportsToSol(metrics.pendingEarnings)} SOL
                        </div>
                        <div className="text-xs text-green-600 font-medium">
                            ${solToUsdSync(lamportsToSol(metrics.pendingEarnings))} USD
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
