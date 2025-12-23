"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";
import axios from "axios";
import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/utils";
import { lamportsToSol } from "@/utils/convert";
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  ExternalLink, 
  CheckCircle, 
  Clock, 
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  BarChart3,
  Filter,
  Search,
  Download,
  Plus
} from "lucide-react";

interface EarningRecord {
  id: number;
  amount: string;
  date: string;
  status: 'completed' | 'paid' | 'ongoing';
  transactionHash?: string;
  taskId?: number;
  taskTitle?: string;
  workerAddress?: string;
  submissionId?: number;
}

interface CreatorEarningsData {
  totalSpent: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  averageTaskCost: string;
  earnings: EarningRecord[];
  metrics: {
    monthlySpent: string;
    weeklySpent: string;
    dailySpent: string;
    totalWorkers: number;
    retentionRate: string;
  };
}

interface CreatorEarningsProps {
  onBack?: () => void;
}

// SOL to USD conversion rate (this should come from a real API)
const SOL_TO_USD_RATE = 150; // Example rate

const solToUsd = (solAmount: string): string => {
  const sol = parseFloat(solAmount) || 0;
  return (sol * SOL_TO_USD_RATE).toFixed(2);
};

export const CreatorEarningsContent = ({ onBack }: CreatorEarningsProps) => {
  const { publicKey } = useWallet();
  const [data, setData] = useState<CreatorEarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ongoing' | 'completed' | 'paid' | 'expired'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const itemsPerPage = 10;

  const fetchWalletBalance = async () => {
    if (!publicKey) return;
    
    try {
      const connection = new Connection(clusterApiUrl("devnet"));
      const balance = await connection.getBalance(publicKey);
      setWalletBalance(lamportsToSol(balance.toString()));
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
    }
  };

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get(`${BACKEND_URL}/v1/user/earnings`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      setData(response.data);
    } catch (error: any) {
      console.error("Error fetching creator earnings:", error);
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
    fetchEarnings();
    fetchWalletBalance();
  }, [publicKey]);

  const filteredEarnings = data?.earnings.filter(earning => {
    const matchesSearch = earning.taskTitle?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          earning.workerAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          earning.submissionId?.toString().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || earning.status === filterStatus;
    return matchesSearch && matchesFilter;
  }) || [];

  // Pagination logic
  const totalPages = Math.ceil(filteredEarnings.length / itemsPerPage);
  const paginatedEarnings = filteredEarnings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ongoing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="h-3 w-3 mr-1" />
            Ongoing
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <DollarSign className="h-3 w-3 mr-1" />
            Paid
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <Clock className="h-3 w-3 mr-1" />
            Expired
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

  const exportData = () => {
    if (!data) return;
    
    const csvContent = [
      ['Date', 'Task', 'Amount (SOL)', 'Amount (USD)', 'Status', 'Worker Address', 'Transaction Hash'],
      ...filteredEarnings.map(earning => [
        new Date(earning.date).toLocaleDateString(),
        earning.taskTitle || 'Unknown Task',
        lamportsToSol(earning.amount),
        solToUsd(lamportsToSol(earning.amount)),
        earning.status,
        earning.workerAddress || 'N/A',
        earning.transactionHash || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creator-earnings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          <div>
            <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">Creator</div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Earnings & Wallet</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Track your spending and transaction history</p>
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
            <Wallet className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No earnings yet</h3>
          <p className="text-sm text-gray-500 mb-4">Create tasks and get worker submissions to see earnings data here</p>
          <button
            onClick={() => window.location.href = '/creator/create'}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
          >
            <Plus className="h-4 w-4" />
            Create Your First Task
          </button>
        </div>
      </div>
    );
  }

  const totalSpentSol = lamportsToSol(data.totalSpent);
  const totalSpentUsd = solToUsd(totalSpentSol);
  const monthlySpentSol = lamportsToSol(data.metrics.monthlySpent);
  const weeklySpentSol = lamportsToSol(data.metrics.weeklySpent);
  const dailySpentSol = lamportsToSol(data.metrics.dailySpent);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-3 mb-6 sm:mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">Creator</div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Earnings & Wallet</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Track your spending and transaction history</p>
          </div>
          <button
            onClick={exportData}
            className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="paid">Paid</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:border-transparent"
          >
            <option value="all">All Time</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Left Column - Stats Cards and Transaction History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Spent - Main Metric */}
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

            {/* Wallet Balance */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="h-11 w-11 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-purple-600" />
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-gray-900">{walletBalance || '0'} SOL</span>
                  <p className="text-xs text-green-600 font-medium">${walletBalance ? solToUsd(walletBalance) : '0'} USD</p>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">Wallet Balance</p>
              <p className="text-xs text-gray-500 mt-1">Current SOL balance</p>
            </div>
            {/* Weekly Spending */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="h-11 w-11 rounded-xl bg-green-100 border border-green-200 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{weeklySpentSol} SOL</span>
              </div>
              <p className="text-sm font-medium text-gray-600">Weekly</p>
              <p className="text-xs text-gray-500 mt-1">This week's spending</p>
            </div>

            {/* Total Tasks */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="h-11 w-11 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{data.totalTasks}</span>
              </div>
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-xs text-gray-500 mt-1">{data.completedTasks} completed</p>
            </div>

            {/* Average Task Cost */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="h-11 w-11 rounded-xl bg-yellow-100 border border-yellow-200 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-yellow-600" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{lamportsToSol(data.averageTaskCost)} SOL</span>
              </div>
              <p className="text-sm font-medium text-gray-600">Avg Task Cost</p>
              <p className="text-xs text-gray-500 mt-1">Per completed task</p>
            </div>

            {/* Total Workers */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="h-11 w-11 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-indigo-600" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{data.metrics.totalWorkers}</span>
              </div>
              <p className="text-sm font-medium text-gray-600">Total Workers</p>
              <p className="text-xs text-gray-500 mt-1">{data.metrics.retentionRate} retention</p>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
              <h3 className="text-lg font-medium text-gray-900">Transaction History</h3>
              <p className="mt-1 text-sm text-gray-500">Complete record of your task payments</p>
            </div>

            {paginatedEarnings.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Wallet className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
                <p className="text-sm text-gray-500">
                  {searchTerm || filterStatus !== 'all' || dateRange !== 'all' 
                    ? 'Try adjusting your search or filter criteria'
                    : 'Create tasks to see your transaction history here'
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                        Date
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                        Task
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                        Worker
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                        Transaction
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedEarnings.map((earning) => (
                      <tr key={earning.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {lamportsToSol(earning.amount)} SOL
                          </div>
                          <div className="text-xs text-green-600 font-medium">${solToUsd(lamportsToSol(earning.amount))} USD</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(earning.date).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(earning.date).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900 truncate max-w-xs">
                            {earning.taskTitle || 'Unknown Task'}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: #{earning.taskId} • Sub: #{earning.submissionId}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getStatusBadge(earning.status)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <div className="text-sm text-gray-900 font-mono">
                            {earning.workerAddress ? 
                              `${earning.workerAddress.slice(0, 4)}...${earning.workerAddress.slice(-4)}` : 
                              'N/A'
                            }
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {earning.transactionHash ? (
                            <button
                              onClick={() => openSolanaExplorer(earning.transactionHash!)}
                              className="text-[#f97316] hover:text-[#ea580c] font-medium flex items-center text-xs"
                            >
                              View on Solana
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredEarnings.length)} of {filteredEarnings.length} results
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quick Stats and Wallet Info */}
        <div className="space-y-6">
          {/* Wallet Summary */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Wallet Summary</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Current Balance</span>
                <span className="text-sm font-medium text-gray-900">-- SOL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Spent</span>
                <span className="text-sm font-medium text-gray-900">{totalSpentSol} SOL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Daily Average</span>
                <span className="text-sm font-medium text-gray-900">{dailySpentSol} SOL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Tasks Created</span>
                <span className="text-sm font-medium text-gray-900">{data.totalTasks}</span>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Performance</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Completion Rate</span>
                <span className="text-sm font-medium text-gray-900">
                  {data.totalTasks > 0 ? ((data.completedTasks / data.totalTasks) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Avg Task Cost</span>
                <span className="text-sm font-medium text-gray-900">{lamportsToSol(data.averageTaskCost)} SOL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Workers</span>
                <span className="text-sm font-medium text-gray-900">{data.metrics.totalWorkers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Worker Retention</span>
                <span className="text-sm font-medium text-gray-900">{data.metrics.retentionRate}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => window.open('/creator/create', '_blank')}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <DollarSign className="h-4 w-4" />
                Create New Task
              </button>
              <button
                onClick={exportData}
                className="w-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
