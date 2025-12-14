'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../utils';
import { HistogramChart } from './HistogramChart';

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
    const itemsPerPage = 5;

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get(`${BACKEND_URL}/v1/user/dashboard`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                setData(response.data);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
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
                    value: stat.tasksCreated
                }));
            case 'weekly':
                // Calculate month-aligned weeks from daily data
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();
                
                // Filter daily stats to current month
                const currentMonthDaily = data.dailyStats.filter(stat => {
                    const date = new Date(stat.date);
                    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
                });
                
                // Group into weeks (Week 1: 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22-28, Week 5: 29+)
                const weeks = [];
                for (let weekNum = 0; weekNum < 5; weekNum++) {
                    const weekStart = weekNum * 7 + 1;
                    const weekEnd = Math.min((weekNum + 1) * 7, new Date(currentYear, currentMonth + 1, 0).getDate());
                    
                    const weekTasks = currentMonthDaily
                        .filter(stat => {
                            const day = new Date(stat.date).getDate();
                            return day >= weekStart && day <= weekEnd;
                        })
                        .reduce((sum, stat) => sum + stat.tasksCreated, 0);
                    
                    weeks.push({
                        label: `Week ${weekNum + 1}`,
                        value: weekTasks
                    });
                }
                
                return weeks;
            case 'monthly':
                return data.monthlyStats.slice(-6).map(stat => ({
                    label: stat.month,
                    value: stat.tasksCreated
                }));
            default:
                return [];
        }
    };

    // Paginated recent activity
    const paginatedActivity = data.recentActivity.slice(
        activityPage * itemsPerPage,
        (activityPage + 1) * itemsPerPage
    );
    const totalPages = Math.ceil(data.recentActivity.length / itemsPerPage);

    return (
        <div className="max-w-7xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Welcome, Awesome Creator</h1>
            
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-blue-500 rounded-lg shadow-sm p-6 text-white">
                    <div>
                        <p className="text-sm text-blue-100">Total Tasks</p>
                        <p className="text-2xl font-bold">{data.overview.totalTasks}</p>
                    </div>
                </div>

                <div className="bg-green-500 rounded-lg shadow-sm p-6 text-white">
                    <div>
                        <p className="text-sm text-green-100">Total Submissions</p>
                        <p className="text-2xl font-bold">{data.overview.totalSubmissions}</p>
                    </div>
                </div>

                <div className="bg-purple-500 rounded-lg shadow-sm p-6 text-white">
                    <div>
                        <p className="text-sm text-purple-100">Total Spent</p>
                        <p className="text-2xl font-bold">{(Number(data.overview.totalSpent) / 1000000).toFixed(2)} SOL</p>
                    </div>
                </div>

                <div className="bg-orange-500 rounded-lg shadow-sm p-6 text-white">
                    <div>
                        <p className="text-sm text-orange-100">Avg Submissions</p>
                        <p className="text-2xl font-bold">{data.overview.averageSubmissionsPerTask}</p>
                    </div>
                </div>
            </div>

            {/* Single Chart with Selector */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold text-gray-800">Task Creation Analytics</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setChartView('daily')}
                            className={`px-3 py-1 rounded text-sm font-medium ${
                                chartView === 'daily'
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            Daily
                        </button>
                        <button
                            onClick={() => setChartView('weekly')}
                            className={`px-3 py-1 rounded text-sm font-medium ${
                                chartView === 'weekly'
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            Weekly
                        </button>
                        <button
                            onClick={() => setChartView('monthly')}
                            className={`px-3 py-1 rounded text-sm font-medium ${
                                chartView === 'monthly'
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            Monthly
                        </button>
                    </div>
                </div>
                <HistogramChart data={getChartData()} color="#8B5CF6" height={300} />
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                    {data.recentActivity.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No recent activity</p>
                    ) : (
                        <>
                            {paginatedActivity.map((activity) => (
                                <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <h4 className="font-medium text-gray-800">{activity.title}</h4>
                                        <p className="text-sm text-gray-600">ID: #{activity.id}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                                            activity.status === 'completed' 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {activity.status}
                                        </span>
                                        <p className="text-sm text-gray-600 mt-1">{activity.submissions} submissions</p>
                                    </div>
                                </div>
                            ))}
                            
                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex justify-center items-center gap-2 mt-4">
                                    <button
                                        onClick={() => setActivityPage(Math.max(0, activityPage - 1))}
                                        disabled={activityPage === 0}
                                        className={`px-3 py-1 rounded text-sm ${
                                            activityPage === 0
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : 'bg-purple-500 text-white hover:bg-purple-600'
                                        }`}
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-gray-600">
                                        Page {activityPage + 1} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setActivityPage(Math.min(totalPages - 1, activityPage + 1))}
                                        disabled={activityPage === totalPages - 1}
                                        className={`px-3 py-1 rounded text-sm ${
                                            activityPage === totalPages - 1
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : 'bg-purple-500 text-white hover:bg-purple-600'
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
