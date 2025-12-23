"use client";

import { BACKEND_URL } from "@/utils";
import axios from "axios";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";
import { lamportsToSol, solToUsdSync, getSolPrice } from "@/utils/convert";
import { 
  TrendingUp, 
  DollarSign, 
  ListTodo, 
  CheckCircle, 
  Clock, 
  Users, 
  BarChart3, 
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Eye,
  Calendar,
  Activity
} from "lucide-react";
import { CountdownTimer } from "@/components/CountdownTimer";

interface CreatorDashboardData {
  overview: {
    totalTasks: number;
    totalSubmissions: number;
    totalSpent: string;
    totalPayouts: string;
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

interface CreatorDashboardProps {
  onTaskCreate?: () => void;
  onViewTasks?: () => void;
  onViewEarnings?: () => void;
}

// Status badge helper function
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Completed
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Pending
        </span>
      );
    case 'expired':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Expired
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Unknown
        </span>
      );
  }
};

export const CreatorDashboardContent = ({ onTaskCreate, onViewTasks, onViewEarnings }: CreatorDashboardProps) => {
  const router = useRouter();
  const [data, setData] = useState<CreatorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [solPriceFetched, setSolPriceFetched] = useState(false);
  const [chartView, setChartView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [analyticsPage, setAnalyticsPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [solPrice, setSolPrice] = useState<number | null>(null);

  const handleCreateTask = () => {
    router.push('/creator/create');
  };

  const handleViewTasks = () => {
    router.push('/creator/tasks');
  };

  const handleViewEarnings = () => {
    router.push('/creator/earnings');
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get(`${BACKEND_URL}/v1/user/dashboard`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      setData(response.data);
    } catch (error: any) {
      console.error("Error fetching creator dashboard data:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("token");
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
            <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">Creator</div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Overview of tasks, submissions, and spend</p>
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
                <div className="h-11 w-11 bg-gray-200 rounded-xl"></div>
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
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <BarChart3 className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No data available</h3>
          <p className="text-sm text-gray-500">Unable to load dashboard information</p>
        </div>
      </div>
    );
  }

  const totalSpentSol = lamportsToSol(data.overview.totalSpent);
  const totalSpentUsd = solToUsdSync(totalSpentSol);
  const totalPayoutsSol = lamportsToSol(data.overview.totalPayouts);
  const totalPayoutsUsd = solToUsdSync(totalPayoutsSol);
  const completionRate = data.overview.totalTasks > 0 
    ? ((data.overview.completedTasks / data.overview.totalTasks) * 100).toFixed(1)
    : "0";

  // Get the appropriate data based on chart view
  const getAnalyticsData = () => {
    switch (chartView) {
      case 'daily':
        return data.dailyStats;
      case 'weekly':
        return data.weeklyStats;
      case 'monthly':
        return data.monthlyStats;
      default:
        return data.dailyStats;
    }
  };

  const analyticsData = getAnalyticsData();
  const getDataLabel = () => {
    switch (chartView) {
      case 'daily':
        return 'Daily Activity';
      case 'weekly':
        return 'Weekly Activity';
      case 'monthly':
        return 'Monthly Activity';
      default:
        return 'Daily Activity';
    }
  };

  const formatDataLabel = (item: any) => {
    switch (chartView) {
      case 'daily':
        return new Date(item.date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
      case 'weekly':
        return `${new Date(item.weekStart).toLocaleDateString('en', { month: 'short', day: 'numeric' })} - ${new Date(item.weekEnd).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
      case 'monthly':
        return item.month;
      default:
        return new Date(item.date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
    }
  };

  // Pagination logic for analytics (4 items per page)
  const analyticsItemsPerPage = 4;
  const analyticsTotalPages = Math.ceil(analyticsData.length / analyticsItemsPerPage);
  const paginatedAnalyticsData = analyticsData.slice(
    (analyticsPage - 1) * analyticsItemsPerPage,
    analyticsPage * analyticsItemsPerPage
  );

  // Pagination logic for recent activity (5 items per page)
  const activityItemsPerPage = 5;
  const activityTotalPages = Math.ceil(data.recentActivity.length / activityItemsPerPage);
  const paginatedActivityData = data.recentActivity.slice(
    (activityPage - 1) * activityItemsPerPage,
    activityPage * activityItemsPerPage
  );

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-3 mb-6 sm:mb-8">
        <div className="flex items-start">
          <div>
            <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">Creator</div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Overview of tasks, submissions, and spend</p>
          </div>
        </div>
      </div>

      {/* Main Layout - Left Side Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Left Column - Stats Cards and Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Tasks */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="h-11 w-11 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center">
                  <ListTodo className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{data.overview.totalTasks}</span>
              </div>
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-xs text-gray-500 mt-1">Created by you</p>
            </div>

            {/* Completed Tasks */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="h-11 w-11 rounded-xl bg-green-100 border border-green-200 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{data.overview.completedTasks}</span>
              </div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-xs text-gray-500 mt-1">{completionRate}% completion rate</p>
            </div>

            {/* Total Spent - Bigger and Emphasized */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <div className="h-11 w-11 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-orange-600" />
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-gray-900">{totalSpentSol} SOL</span>
                  <p className="text-xs text-green-600 font-medium">${totalSpentUsd} USD</p>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">Total Spent</p>
              <p className="text-xs text-gray-500 mt-1">Across all tasks</p>
            </div>

            {/* Pending Tasks */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="h-11 w-11 rounded-xl bg-yellow-100 border border-yellow-200 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{data.overview.pendingTasks}</span>
              </div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-xs text-gray-500 mt-1">Awaiting completion</p>
            </div>

            {/* Total Payouts */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="h-11 w-11 rounded-xl bg-green-100 border border-green-200 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-gray-900">{totalPayoutsSol} SOL</span>
                  <p className="text-xs text-green-600 font-medium">${totalPayoutsUsd} USD</p>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">Total Payouts</p>
              <p className="text-xs text-gray-500 mt-1">Paid to workers</p>
            </div>

            {/* Total Submissions */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="h-11 w-11 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{data.overview.totalSubmissions}</span>
              </div>
              <p className="text-sm font-medium text-gray-600">Submissions</p>
              <p className="text-xs text-gray-500 mt-1">{data.overview.averageSubmissionsPerTask} avg per task</p>
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
                  <p className="mt-1 text-sm text-gray-500">Latest task updates and submissions</p>
                </div>
                <button
                  onClick={handleViewTasks}
                  className="text-[#f97316] hover:text-[#ea580c] font-medium flex items-center text-sm"
                >
                  View all
                  <Eye className="h-4 w-4 ml-1" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {data.recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <div className="bg-gray-100 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                    <Activity className="h-6 w-6 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">No recent activity</h3>
                  <p className="text-xs text-gray-500">Your task activity will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedActivityData.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {activity.title}
                          </div>
                          {getStatusBadge(activity.status)}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {lamportsToSol(activity.amount)} SOL
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(activity.createdAt).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {activity.submissions} submissions
                          </div>
                        </div>
                      </div>
                      {activity.expiresAt && activity.status === 'ongoing' && (
                        <div className="ml-4 flex-shrink-0">
                          <CountdownTimer expiresAt={activity.expiresAt} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Activity Pagination Controls */}
              {activityTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    Showing {((activityPage - 1) * activityItemsPerPage) + 1} to {Math.min(activityPage * activityItemsPerPage, data.recentActivity.length)} of {data.recentActivity.length} activities
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActivityPage(prev => Math.max(prev - 1, 1))}
                      disabled={activityPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-700">
                      {activityPage} / {activityTotalPages}
                    </span>
                    <button
                      onClick={() => setActivityPage(prev => Math.min(prev + 1, activityTotalPages))}
                      disabled={activityPage === activityTotalPages}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Quick Actions and Stats */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={handleCreateTask}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create New Task
              </button>
              <button
                onClick={handleViewTasks}
                className="w-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <ListTodo className="h-4 w-4" />
                View All Tasks
              </button>
              <button
                onClick={handleViewEarnings}
                className="w-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <DollarSign className="h-4 w-4" />
                View Earnings
              </button>
            </div>
          </div>

          {/* Performance Summary */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Performance</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Completion Rate</span>
                <span className="text-sm font-medium text-gray-900">{completionRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Avg Submissions/Task</span>
                <span className="text-sm font-medium text-gray-900">{data.overview.averageSubmissionsPerTask}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Active Tasks</span>
                <span className="text-sm font-medium text-gray-900">{data.overview.pendingTasks}</span>
              </div>
            </div>
          </div>

          {/* Recent Chart View Toggle */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{getDataLabel()}</h3>
            
            {/* Toggle Buttons */}
            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm w-full mb-4">
              <button
                onClick={() => setChartView('daily')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  chartView === 'daily'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setChartView('weekly')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  chartView === 'weekly'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setChartView('monthly')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  chartView === 'monthly'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Monthly
              </button>
            </div>

            {/* Analytics Data Display */}
            <div className="space-y-3">
              {paginatedAnalyticsData.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {formatDataLabel(item)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {chartView === 'daily' && 'Tasks vs Submissions'}
                      {chartView === 'weekly' && 'Weekly performance'}
                      {chartView === 'monthly' && 'Monthly overview'}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-orange-600">
                        {item.tasksCreated}
                      </div>
                      <div className="text-xs text-gray-500">Tasks</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-600">
                        {item.submissionsReceived}
                      </div>
                      <div className="text-xs text-gray-500">Submissions</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Analytics Pagination Controls */}
            {analyticsTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  Showing {((analyticsPage - 1) * analyticsItemsPerPage) + 1} to {Math.min(analyticsPage * analyticsItemsPerPage, analyticsData.length)} of {analyticsData.length} items
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAnalyticsPage(prev => Math.max(prev - 1, 1))}
                    disabled={analyticsPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-700">
                    {analyticsPage} / {analyticsTotalPages}
                  </span>
                  <button
                    onClick={() => setAnalyticsPage(prev => Math.min(prev + 1, analyticsTotalPages))}
                    disabled={analyticsPage === analyticsTotalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
