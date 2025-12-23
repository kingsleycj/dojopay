"use client";

import { BACKEND_URL } from "@/utils";
import axios from "axios";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";
import { lamportsToSol, solToUsdSync, getSolPrice } from "@/utils/convert";
import { Clock, CheckCircle, DollarSign, TrendingUp, ListTodo, History, ArrowRight } from "lucide-react";
import { Task } from "@/types/worker";

interface WorkerDashboardData {
    availableTasks: number;
    completedTasks: number;
    pendingEarnings: string;
    totalEarned: string;
    recentTasks: Array<{
        id: number;
        title: string;
        amount: string;
        status: 'available' | 'completed' | 'pending' | 'paid';
        createdAt: string;
        expiresAt?: string;
    }>;
}

interface WorkerDashboardProps {
    onTaskSelect?: (taskId: number) => void;
    onViewTasks?: () => void;
    onViewEarnings?: () => void;
}

export const WorkerDashboardContent = ({ onTaskSelect, onViewTasks, onViewEarnings }: WorkerDashboardProps) => {
    const [data, setData] = useState<WorkerDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [solPriceFetched, setSolPriceFetched] = useState(false);
    const router = useRouter();

    const handleViewTasks = () => {
        router.push('/worker/tasks');
    };

    const handleViewEarnings = () => {
        router.push('/worker/earnings');
    };

    const fetchDashboardData = async () => {
        try {
            const token = localStorage.getItem("workerToken");
            if (!token) {
                setLoading(false);
                return;
            }

            // Single dashboard API call
            const response = await axios.get(`${BACKEND_URL}/v1/worker/dashboard`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            const data = response.data;
            
            // Convert lamports to SOL for amounts
            const pendingEarnings = lamportsToSol(data.metrics.pendingEarnings || "0").toString();
            const totalEarned = lamportsToSol(data.metrics.totalEarned || "0").toString();

            // Convert recent tasks amounts to SOL
            const recentTasks = data.recentTasks.map((task: any) => ({
                ...task,
                amount: lamportsToSol(task.amount || "1000000").toString()
            }));

            setData({
                availableTasks: data.metrics.availableTasks,
                completedTasks: data.metrics.completedTasks,
                pendingEarnings,
                totalEarned,
                recentTasks
            });

        } catch (error: any) {
            console.error("Error fetching worker dashboard data:", error);
            if (error.response?.status === 401 || error.response?.status === 403) {
                localStorage.removeItem("workerToken");
                window.location.href = "/";
            } else {
                setData(null);
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
        
        fetchDashboardData();
    }, []);

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col gap-3 mb-4 sm:mb-6">
                    <div>
                        <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">Worker</div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Dashboard</h1>
                        <p className="text-sm sm:text-base text-gray-600 mt-1">Track your earnings and progress</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 animate-pulse">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                                    <div className="h-8 bg-gray-200 rounded w-16"></div>
                                </div>
                                <div className="h-11 w-11 rounded-xl bg-gray-200 ml-2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
                <div className="text-center text-gray-500 mt-12">
                    <p>Unable to load dashboard data</p>
                </div>
            </div>
        );
    }

    const pendingEarningsSol = data.pendingEarnings; // Already converted to SOL
    const totalEarnedSol = data.totalEarned; // Already converted to SOL
    const pendingEarningsUsd = solToUsdSync(pendingEarningsSol);
    const totalEarnedUsd = solToUsdSync(totalEarnedSol);

    return (
        <div key={`dashboard-${data.availableTasks}`} className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
            {/* Header Section */}
            <div className="flex flex-col gap-3 mb-6 sm:mb-8">
                <div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">Worker</div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-sm sm:text-base text-gray-600 mt-1">Track your earnings and progress</p>
                </div>
            </div>

            {/* Main Layout - Left Side Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Left Column - Stats Cards and Recent Activity */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Stats Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Available Tasks */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-11 w-11 rounded-xl bg-green-100 border border-green-200 flex items-center justify-center">
                                    <ListTodo className="h-6 w-6 text-green-600" />
                                </div>
                                <span className="text-2xl font-bold text-gray-900">{data.availableTasks}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-600">Available Tasks</p>
                            <p className="text-xs text-gray-500 mt-1">Ready to complete</p>
                        </div>

                        {/* Completed Tasks */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-11 w-11 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center">
                                    <CheckCircle className="h-6 w-6 text-blue-600" />
                                </div>
                                <span className="text-2xl font-bold text-gray-900">{data.completedTasks}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-600">Completed Tasks</p>
                            <p className="text-xs text-gray-500 mt-1">Successfully done</p>
                        </div>

                        {/* Pending Earnings - Bigger and Green */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-11 w-11 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center">
                                    <DollarSign className="h-6 w-6 text-orange-600" />
                                </div>
                                <div className="text-right">
                                    <span className="text-3xl font-bold text-green-600">{pendingEarningsSol}</span>
                                    <span className="text-lg text-green-500 ml-1">SOL</span>
                                </div>
                            </div>
                            <p className="text-sm font-medium text-gray-600">Pending Earnings</p>
                            <p className="text-sm text-green-600 font-medium">${pendingEarningsUsd} USD</p>
                        </div>

                        {/* Total Earned - Bigger and Green */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-11 w-11 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center">
                                    <TrendingUp className="h-6 w-6 text-purple-600" />
                                </div>
                                <div className="text-right">
                                    <span className="text-3xl font-bold text-green-600">{totalEarnedSol}</span>
                                    <span className="text-lg text-green-500 ml-1">SOL</span>
                                </div>
                            </div>
                            <p className="text-sm font-medium text-gray-600">Total Earned</p>
                            <p className="text-sm text-green-600 font-medium">${totalEarnedUsd} USD</p>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
                            <button 
                                onClick={onViewTasks}
                                className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                            >
                                View all
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                        
                        {data.recentTasks.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                    <History className="h-8 w-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
                                <p className="text-sm text-gray-500 mb-4">Complete tasks to see your activity here</p>
                                <button
                                    onClick={onViewTasks}
                                    className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                                >
                                    Find Tasks
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data.recentTasks.map((task) => (
                                    <div key={task.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(task.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 ml-4">
                                            <span className="text-base font-bold text-gray-900">{task.amount} SOL</span>
                                            <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                                                task.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                task.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {task.status === 'completed' ? 'Completed' :
                                                 task.status === 'paid' ? 'Paid' : 'Pending'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column - Quick Actions & Stats Summary */}
                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                        <div className="space-y-3">
                            <button
                                onClick={handleViewTasks}
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <ListTodo className="h-5 w-5" />
                                Browse Tasks
                            </button>
                            <button
                                onClick={handleViewEarnings}
                                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <DollarSign className="h-5 w-5" />
                                View Earnings
                            </button>
                            <button
                                onClick={() => showToast("Withdrawal feature available in Earnings", "info")}
                                className="w-full bg-white hover:bg-gray-50 border-2 border-gray-200 text-gray-900 px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <ArrowRight className="h-5 w-5" />
                                Quick Withdraw
                            </button>
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200 shadow-sm p-5">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Today's Summary</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Tasks Available</span>
                                <span className="text-lg font-bold text-green-600">{data.availableTasks}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Pending SOL</span>
                                <span className="text-lg font-bold text-green-600">{pendingEarningsSol}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Total Earned</span>
                                <span className="text-lg font-bold text-green-600">{totalEarnedSol}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
