'use client';

import { lamportsToSol } from '../utils/convert';
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../utils';
import { DualBarChart } from './Chart';
import { CountdownTimer } from './CountdownTimer';
import { showToast } from './Toast';
import { Coins, Gauge, Inbox, Layers3 } from 'lucide-react';

interface DashboardData {
    overview: {
        totalTasks: number;
        totalSubmissions: number;
        totalSpent: string;
        completedTasks: number;
        pendingTasks: number;
        averageSubmissionsPerTask: string;
    };
    dailyStats: Array<{
        date: string;
        tasksCreated: number;
        submissionsReceived: number;
    }>;
    weeklyStats: Array<{
        weekStart: string;
        weekEnd: string;
        tasksCreated: number;
        submissionsReceived: number;
    }>;
    monthlyStats: Array<{
        month: string;
        tasksCreated: number;
        submissionsReceived: number;
    }>;
    recentActivity: Array<{
        id: number;
        title: string;
        status: string;
        createdAt: string;
        expiresAt: string | null;
        amount: string;
        submissions: number;
    }>;
    completionTrend: Array<{
        period: string;
        completionRate: number;
    }>;
}

export const DashboardView = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [chartView, setChartView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [activityPage, setActivityPage] = useState(0);
    const [hasShownLoginToast, setHasShownLoginToast] = useState(false);
    const hasFetchedRef = useRef(false);
    const itemsPerPage = 5;
    const [solPriceUsd, setSolPriceUsd] = useState<number | null>(null);

    useEffect(() => {
        const cacheKey = 'dojopay_sol_price_usd_v1';
        const cacheTtlMs = 60_000;

        try {
            const cachedRaw = sessionStorage.getItem(cacheKey);
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw) as { price: number; ts: number };
                if (typeof cached?.price === 'number' && typeof cached?.ts === 'number') {
                    if (Date.now() - cached.ts < cacheTtlMs) {
                        setSolPriceUsd(cached.price);
                        return;
                    }
                }
            }
        } catch {
            // ignore
        }

        const controller = new AbortController();
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
            signal: controller.signal,
            headers: {
                'accept': 'application/json'
            }
        })
            .then((r) => r.json())
            .then((json) => {
                const price = json?.solana?.usd;
                if (typeof price === 'number' && Number.isFinite(price)) {
                    setSolPriceUsd(price);
                    try {
                        sessionStorage.setItem(cacheKey, JSON.stringify({ price, ts: Date.now() }));
                    } catch {
                        // ignore
                    }
                }
            })
            .catch(() => {
                // ignore
            });

        return () => controller.abort();
    }, []);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (hasFetchedRef.current) return; // Prevent multiple fetches completely
            
            hasFetchedRef.current = true;
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get(`${BACKEND_URL}/v1/user/dashboard`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                setData(response.data);
                if (!hasShownLoginToast) {
                    showToast('Login successful!', 'success');
                    setHasShownLoginToast(true);
                }
            } catch (error: any) {
                console.error('Error fetching dashboard data:', error);
                // If authentication fails, clear token and redirect to landing page
                if (error.response?.status === 401 || error.response?.status === 403) {
                    console.log('Dashboard authentication failed, clearing token and redirecting');
                    localStorage.removeItem('token');
                    localStorage.removeItem('workerToken');
                    window.location.href = '/';
                }
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    // Move this useEffect here to prevent hook order changes
    useEffect(() => {
        if (activityPage === 0) return;
        if (!data) return;
        const maxPage = Math.max(0, Math.ceil(data.recentActivity.length / itemsPerPage) - 1);
        if (activityPage > maxPage) {
            setActivityPage(maxPage);
        }
    }, [data?.recentActivity.length, activityPage]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f97316]"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="max-w-7xl mx-auto p-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>
                <div className="text-center text-gray-500">
                    <p>Unable to load dashboard data</p>
                </div>
            </div>
        );
    }

    // Prepare chart data based on selected view
    const getChartData = () => {
        switch (chartView) {
            case 'daily':
                return data.dailyStats.slice(-7).map(stat => ({
                    label: new Date(stat.date).toLocaleDateString('en', { weekday: 'short' }),
                    fullLabel: new Date(stat.date).toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
                    value: stat.tasksCreated
                }));
            case 'weekly':
                const weeks = [];
                for (let i = 0; i < Math.min(8, data.weeklyStats?.length || 0); i++) {
                    const weekNum = i;
                    const weekTasks = data.dailyStats
                        .slice(i * 7, (i + 1) * 7)
                        .reduce((sum, stat) => sum + stat.tasksCreated, 0);
                    
                    weeks.push({
                        label: `W${weekNum + 1}`,
                        fullLabel: `Week ${weekNum + 1}`,
                        value: weekTasks
                    });
                }
                
                return weeks;
            case 'monthly':
                return data.monthlyStats.slice(-6).map(stat => ({
                    label: stat.month.slice(0, 3),
                    fullLabel: stat.month,
                    value: stat.tasksCreated
                }));
            default:
                return [];
        }
    };

    const getCombinedActivityChartData = () => {
        const tasks = getChartData();
        const submissions = getSubmissionsChartData();
        return tasks.map((t, i) => ({
            label: t.label,
            fullLabel: t.fullLabel,
            a: t.value,
            b: submissions[i]?.value ?? 0
        }));
    };

    const getSubmissionsChartData = () => {
        switch (chartView) {
            case 'daily':
                return data.dailyStats.slice(-7).map(stat => ({
                    label: new Date(stat.date).toLocaleDateString('en', { weekday: 'short' }),
                    fullLabel: new Date(stat.date).toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
                    value: stat.submissionsReceived
                }));
            case 'weekly':
                return getChartData().map((w, i) => ({
                    label: w.label,
                    fullLabel: w.fullLabel,
                    value: data.weeklyStats?.[i]?.submissionsReceived ?? 0
                }));
            case 'monthly':
                return data.monthlyStats.slice(-6).map(stat => ({
                    label: stat.month.slice(0, 3),
                    fullLabel: stat.month,
                    value: 0
                }));
            default:
                return [];
        }
    };

    const totalSpentSolStr = lamportsToSol(data.overview.totalSpent);
    const totalSpentSol = Number.parseFloat(totalSpentSolStr);
    const totalSpentUsd = solPriceUsd && Number.isFinite(totalSpentSol) ? totalSpentSol * solPriceUsd : null;

    const filteredRecentActivity = data.recentActivity.filter((activity) => {
        if (!activity.expiresAt) return true;
        const expiresAtMs = new Date(activity.expiresAt).getTime();
        if (!Number.isFinite(expiresAtMs)) return true;
        const hideAtMs = expiresAtMs + 24 * 60 * 60 * 1000;
        return Date.now() < hideAtMs;
    });

    // Paginated recent activity
    const paginatedActivity = filteredRecentActivity.slice(
        activityPage * itemsPerPage,
        (activityPage + 1) * itemsPerPage
    );
    const totalPages = Math.ceil(filteredRecentActivity.length / itemsPerPage);

    return (
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
            <div className="flex flex-col gap-3 mb-4 sm:mb-6">
                <div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">Creator</div>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">Overview of tasks, submissions, and spend.</p>
                </div>
                <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm w-fit">
                    <button
                        onClick={() => setChartView('daily')}
                        className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            chartView === 'daily'
                                ? 'bg-gray-900 text-white'
                                : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        Daily
                    </button>
                    <button
                        onClick={() => setChartView('weekly')}
                        className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            chartView === 'weekly'
                                ? 'bg-gray-900 text-white'
                                : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        Weekly
                    </button>
                    <button
                        onClick={() => setChartView('monthly')}
                        className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            chartView === 'monthly'
                                ? 'bg-gray-900 text-white'
                                : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        Monthly
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
                <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-3 sm:p-4 lg:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Tasks</p>
                            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mt-1 truncate">{data.overview.totalTasks}</p>
                        </div>
                        <div className="h-8 w-8 sm:h-11 sm:w-11 rounded-xl bg-[#fff7ed] border border-[#fed7aa] flex items-center justify-center flex-shrink-0 ml-2">
                            <Layers3 className="h-4 w-4 sm:h-5 sm:w-5 text-gray-900" />
                        </div>
                    </div>
                    <div className="mt-2 sm:mt-4 text-xs sm:text-sm text-gray-600">
                        <span className="font-semibold text-gray-900">{data.overview.completedTasks}</span> completed
                        <span className="mx-1 sm:mx-2 text-gray-300">|</span>
                        <span className="font-semibold text-gray-900">{data.overview.pendingTasks}</span> pending
                    </div>
                </div>

                <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-3 sm:p-4 lg:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Submissions</p>
                            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mt-1 truncate">{data.overview.totalSubmissions}</p>
                        </div>
                        <div className="h-8 w-8 sm:h-11 sm:w-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 ml-2">
                            <Inbox className="h-4 w-4 sm:h-5 sm:w-5 text-gray-900" />
                        </div>
                    </div>
                    <div className="mt-2 sm:mt-4 text-xs sm:text-sm text-gray-600">
                        Avg per task
                        <span className="ml-1 sm:ml-2 font-semibold text-gray-900">{data.overview.averageSubmissionsPerTask}</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-3 sm:p-4 lg:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Spent</p>
                            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mt-1 truncate">{totalSpentSolStr} SOL</p>
                            <p className="text-xs sm:text-sm text-green-600 mt-1">
                                {totalSpentUsd === null
                                    ? '—'
                                    : totalSpentUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                            </p>
                        </div>
                        <div className="h-8 w-8 sm:h-11 sm:w-11 rounded-xl bg-[#fff7ed] border border-[#fed7aa] flex items-center justify-center flex-shrink-0 ml-2">
                            <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-gray-900" />
                        </div>
                    </div>
                    <div className="mt-2 sm:mt-4 text-xs text-gray-500">
                        USD uses live SOL price (cached)
                    </div>
                </div>

                <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-3 sm:p-4 lg:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Completion</p>
                            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mt-1 truncate">{data.completionTrend?.[data.completionTrend.length - 1]?.completionRate ?? 0}%</p>
                        </div>
                        <div className="h-8 w-8 sm:h-11 sm:w-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 ml-2">
                            <Gauge className="h-4 w-4 sm:h-5 sm:w-5 text-gray-900" />
                        </div>
                    </div>
                    <div className="mt-2 sm:mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                            className="h-2 rounded-full bg-[#f97316]"
                            style={{ width: `${Math.min(100, Math.max(0, data.completionTrend?.[data.completionTrend.length - 1]?.completionRate ?? 0))}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Activity Trend */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-5 mb-4 sm:mb-6 lg:mb-8">
                <div className="flex flex-col gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div>
                        <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900">Activity trend</h3>
                        <p className="text-xs sm:text-sm text-gray-600">Tasks created vs submissions received.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap items-center gap-2 sm:gap-3 text-xs font-semibold">
                        <div className="inline-flex items-center gap-1 sm:gap-2">
                            <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-sm" style={{ backgroundColor: '#f97316' }} />
                            <span className="text-gray-700">Tasks</span>
                        </div>
                        <div className="inline-flex items-center gap-1 sm:gap-2">
                            <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-sm" style={{ backgroundColor: '#111827' }} />
                            <span className="text-gray-700">Submissions</span>
                        </div>
                    </div>
                </div>
                <div className="w-full h-32 sm:h-40 md:h-48 lg:h-50">
                    <DualBarChart data={getCombinedActivityChartData()} aColor="#f97316" bColor="#111827" height={150} />
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
                    <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900">Recent activity</h3>
                    <div className="text-xs text-gray-500">Last {Math.min(itemsPerPage, filteredRecentActivity.length)} shown</div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                    {filteredRecentActivity.length === 0 ? (
                        <p className="text-gray-500 text-center py-3 sm:py-4">No recent activity</p>
                    ) : (
                        <>
                            {paginatedActivity.map((activity) => (
                                <div key={activity.id} className="flex flex-col gap-2 sm:gap-0 p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200/60">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-gray-900 text-sm sm:text-base line-clamp-2 pr-16 sm:pr-0">{activity.title}</h4>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600 mt-0.5">
                                            <span>ID: #{activity.id}</span>
                                            {activity.expiresAt && (
                                                <div className="inline-flex w-fit">
                                                    <CountdownTimer expiresAt={activity.expiresAt} compact={true} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-row sm:flex-col items-end justify-between gap-2 sm:gap-1">
                                        <span className={`inline-block px-2 py-1 text-xs rounded-full flex-shrink-0 ${
                                            activity.status === 'completed' 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-[#fff7ed] text-gray-900 border border-[#fed7aa]'
                                        }`}>
                                            {activity.status}
                                        </span>
                                        <p className="text-xs sm:text-sm text-gray-600 text-right">{activity.submissions} submissions</p>
                                    </div>
                                </div>
                            ))}
                            
                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex justify-center items-center gap-2 mt-4">
                                    <button
                                        onClick={() => setActivityPage(Math.max(0, activityPage - 1))}
                                        disabled={activityPage === 0}
                                        className={`px-3 py-1 rounded text-xs sm:text-sm ${
                                            activityPage === 0
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : 'bg-gray-900 text-white hover:bg-gray-800'
                                        }`}
                                    >
                                        Previous
                                    </button>
                                    <span className="text-xs sm:text-sm text-gray-600">
                                        Page {activityPage + 1} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setActivityPage(Math.min(totalPages - 1, activityPage + 1))}
                                        disabled={activityPage === totalPages - 1}
                                        className={`px-3 py-1 rounded text-xs sm:text-sm ${
                                            activityPage === totalPages - 1
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : 'bg-gray-900 text-white hover:bg-gray-800'
                                        }`}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
