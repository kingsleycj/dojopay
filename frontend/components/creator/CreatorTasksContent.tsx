"use client";

import { BACKEND_URL } from "@/utils";
import axios from "axios";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";
import { lamportsToSol } from "@/utils/convert";
import { 
  Plus, 
  Clock, 
  CheckCircle, 
  Users, 
  Eye, 
  Edit, 
  Calendar,
  Image as ImageIcon,
  MoreVertical,
  Filter,
  Search,
  ArrowUpRight
} from "lucide-react";

interface TaskOption {
  id: number;
  imageUrl: string;
}

interface Task {
  id: number;
  title: string;
  amount: string;
  status: 'ongoing' | 'completed' | 'expired';
  createdAt: string;
  expiresAt: string | null;
  totalSubmissions: number;
  options: TaskOption[];
}

interface CreatorTasksProps {
  onTaskCreate?: () => void;
  onTaskSelect?: (taskId: number) => void;
}

export const CreatorTasksContent = ({ onTaskCreate, onTaskSelect }: CreatorTasksProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ongoing' | 'completed' | 'expired'>('all');
  const router = useRouter();

  const handleCreateTask = () => {
    router.push('/creator/tasks/create');
  };

  const handleViewTask = (taskId: number) => {
    router.push(`/creator/task/${taskId}`);
  };

  const handleEditTask = (taskId: number) => {
    router.push(`/creator/task/${taskId}/edit`);
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get(`${BACKEND_URL}/v1/user/tasks`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      setTasks(response.data.tasks);
    } catch (error: any) {
      console.error("Error fetching tasks:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("token");
        window.location.href = "/";
      } else {
        setTasks([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || task.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

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

  const getTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    if (days > 0) {
      return `${days}d ${remainingHours}h`;
    } else {
      return `${hours}h`;
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          <div>
            <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">Creator</div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Tasks</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Manage your created tasks and track submissions</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20 mb-3"></div>
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="flex gap-2">
                <div className="h-8 bg-gray-200 rounded flex-1"></div>
                <div className="h-8 bg-gray-200 rounded flex-1"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-3 mb-6 sm:mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">Creator</div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Tasks</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Manage your created tasks and track submissions</p>
          </div>
          <button
            onClick={handleCreateTask}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Task
          </button>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2 relative">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Tasks</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="expired">Expired</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tasks Grid */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="text-center py-12">
            <div className="bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || filterStatus !== 'all' ? 'No matching tasks found' : 'No tasks yet'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchTerm || filterStatus !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Create your first task to get started'
              }
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button
                onClick={handleCreateTask}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
              >
                <Plus className="h-4 w-4" />
                Create Task
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <div key={task.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              {/* Task Header */}
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500">ID: #{task.id}</span>
                  {getStatusBadge(task.status)}
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2" title={task.title}>
                  {task.title}
                </h3>
                
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xl font-bold text-gray-900">{lamportsToSol(task.amount)} SOL</span>
                  {task.expiresAt && (
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getTimeRemaining(task.expiresAt)}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {task.totalSubmissions} submissions
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(task.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Task Images */}
              {task.options.length > 0 && (
                <div className="px-5 py-3 border-b border-gray-100">
                  <div className="flex gap-2">
                    {task.options.slice(0, 3).map((option, index) => (
                      <div key={option.id} className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                        <img 
                          src={option.imageUrl} 
                          alt={`Option ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {task.options.length > 3 && (
                      <div className="w-12 h-12 rounded-lg border border-gray-200 flex items-center justify-center bg-gray-100 flex-shrink-0">
                        <span className="text-xs text-gray-600">+{task.options.length - 3}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Task Actions */}
              <div className="p-5">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewTask(task.id)}
                    className="flex-1 bg-gray-900 hover:bg-gray-800 text-white px-3 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Eye className="h-4 w-4" />
                    View Details
                  </button>
                  {task.status === 'ongoing' && (
                    <button
                      onClick={() => handleEditTask(task.id)}
                      className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {tasks.length > 0 && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Tasks</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{tasks.length}</div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Ongoing</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">
              {tasks.filter(t => t.status === 'ongoing').length}
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">
              {tasks.filter(t => t.status === 'completed').length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
