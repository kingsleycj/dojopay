"use client";

import { BACKEND_URL } from "@/utils";
import axios from "axios";
import { useEffect, useState } from "react";
import { showToast } from "@/components/Toast";
import { lamportsToSol } from "@/utils/convert";
import dynamic from 'next/dynamic';
import { Task } from "@/types/worker";

// Import all icons dynamically to prevent hydration
const Clock = dynamic(() => import('lucide-react').then(mod => ({ default: mod.Clock })), { ssr: false });
const CheckCircle = dynamic(() => import('lucide-react').then(mod => ({ default: mod.CheckCircle })), { ssr: false });
const DollarSign = dynamic(() => import('lucide-react').then(mod => ({ default: mod.DollarSign })), { ssr: false });
const Eye = dynamic(() => import('lucide-react').then(mod => ({ default: mod.Eye })), { ssr: false });
const Calendar = dynamic(() => import('lucide-react').then(mod => ({ default: mod.Calendar })), { ssr: false });

// Import CountdownTimer dynamically
const CountdownTimer = dynamic(() => import('@/components/CountdownTimer').then(mod => ({ default: mod.CountdownTimer })), { ssr: false });

// Import Toast dynamically as well
const ToastContainer = dynamic(() => import('@/components/Toast').then(mod => ({ default: mod.ToastContainer })), { ssr: false });

// Client-only component wrapper to prevent hydration issues
const ClientOnly = ({ children }: { children: React.ReactNode }) => {
    const [hasMounted, setHasMounted] = useState(false);
    
    useEffect(() => {
        setHasMounted(true);
    }, []);
    
    if (!hasMounted) {
        return (
            <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col gap-3 mb-6">
                    <div>
                        <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">Worker</div>
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Tasks</h1>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">Manage your available and completed tasks.</p>
                    </div>
                </div>
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-4 bg-gray-200 rounded w-full mb-3"></div>
                                <div className="flex justify-between">
                                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
    
    return <>{children}</>;
};

interface WorkerTasksProps {
    onTaskSelect?: (task: Task) => void;
}

export const WorkerTasksContent = ({ onTaskSelect }: WorkerTasksProps) => {
    const [activeTab, setActiveTab] = useState<'available' | 'completed'>('available');
    const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
    const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const fetchAvailableTasks = async () => {
        try {
            const token = localStorage.getItem("workerToken");
            if (!token) return;

            // Fetch next available task from backend
            const response = await axios.get(`${BACKEND_URL}/v1/worker/nextTask`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            // The task is at the root level of response.data, not nested under "task"
            if (response.data && response.data.id) {
                const task = response.data;
                
                // Calculate worker's earnings: task.amount / TOTAL_SUBMISSIONS (100)
                const workerAmountLamports = BigInt(task.amount) / BigInt(100);
                const workerAmountSol = lamportsToSol(workerAmountLamports.toString());
                
                const formattedTask: Task = {
                    id: task.id,
                    title: task.title || "Label this image",
                    description: task.description || "Select the best label for this image",
                    amount: workerAmountSol, // Use worker's calculated amount
                    status: 'available',
                    createdAt: task.createdAt || new Date().toISOString(), // Use createdAt or current date
                    expiresAt: task.expiresAt,
                    options: task.options || []
                };
                setAvailableTasks([formattedTask]);
            } else {
                setAvailableTasks([]);
            }
        } catch (error: any) {
            console.error("Error fetching available tasks:", error);
            if (error.response?.status === 401 || error.response?.status === 403) {
                localStorage.removeItem("workerToken");
                window.location.href = "/";
            } else {
                setAvailableTasks([]);
            }
        }
    };

    const fetchCompletedTasks = async () => {
        try {
            const token = localStorage.getItem("workerToken");
            if (!token) return;

            const response = await axios.get(`${BACKEND_URL}/v1/worker/submissions`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            const submissions = response.data?.submissions || [];
            const tasks: Task[] = submissions.map((s: any) => ({
                id: s.task_id,
                title: s.task_title || `Task #${s.task_id}`,
                description: "Completed task",
                amount: lamportsToSol(s.amount || "1000000").toString(), // Convert lamports to SOL
                status: 'completed', // All submissions should show as completed
                createdAt: new Date().toISOString(), // Use current date since created_at doesn't exist
                expiresAt: null
            }));

            setCompletedTasks(tasks);
        } catch (error: any) {
            console.error("Error fetching completed tasks:", error);
            if (error.response?.status === 401 || error.response?.status === 403) {
                localStorage.removeItem("workerToken");
                window.location.href = "/";
            } else {
                setCompletedTasks([]);
            }
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            await Promise.all([fetchAvailableTasks(), fetchCompletedTasks()]);
            setLoading(false);
        };

        fetchData();
    }, []);

    const handleTaskClick = (task: Task) => {
        if (task.status === 'available') {
            setSelectedTask(task);
            onTaskSelect?.(task);
        }
    };

    const handleBackToTasks = () => {
        setSelectedTask(null);
    };

    const TaskDetailView = ({ task }: { task: Task }) => {
        const [selectedOption, setSelectedOption] = useState<number | null>(null);
        const [submitting, setSubmitting] = useState(false);

        const handleSubmit = async () => {
            if (selectedOption === null) {
                showToast("Please select an option", "error");
                return;
            }

            setSubmitting(true);
            try {
                const token = localStorage.getItem("workerToken");
                if (!token) {
                    showToast("Please log in again", "error");
                    return;
                }

                const response = await axios.post(`${BACKEND_URL}/v1/worker/submission`, {
                    taskId: task.id.toString(),
                    selection: selectedOption.toString()
                }, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                showToast("Task submitted successfully!", "success");
                setSelectedTask(null);
                fetchAvailableTasks(); // Refresh available tasks
                fetchCompletedTasks(); // Refresh completed tasks
            } catch (error: any) {
                console.error("Submission error:", error);
                showToast(error.response?.data?.message || "Failed to submit task", "error");
            } finally {
                setSubmitting(false);
            }
        };

        return (
            <div className="max-w-4xl mx-auto pt-8">
                <div className="mb-8">
                    <button
                        onClick={handleBackToTasks}
                        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Tasks
                    </button>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{task.title}</h2>
                        {task.description && (
                            <p className="text-gray-600">{task.description}</p>
                        )}
                    </div>

                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    {task.amount} SOL
                                </span>
                                {task.expiresAt && (
                                    <div className="flex items-center text-sm text-orange-600">
                                        <Clock className="h-4 w-4 mr-1" />
                                        <ClientOnly>
                                            <CountdownTimer expiresAt={task.expiresAt} />
                                        </ClientOnly>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select the best option:</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {task.options?.map((option, index) => (
                                <div
                                    key={option.id}
                                    onClick={() => setSelectedOption(option.id)}
                                    className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                                        selectedOption === option.id
                                            ? 'border-[#f97316] ring-2 ring-[#f97316]/20'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="aspect-square relative">
                                        <img
                                            src={option.imageUrl}
                                            alt={`Option ${index + 1}`}
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                        {selectedOption === option.id && (
                                            <div className="absolute top-2 right-2 bg-[#f97316] text-white rounded-full p-1">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || selectedOption === null}
                            className="bg-[#f97316] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#ea580c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            {submitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Submitting...
                                </>
                            ) : (
                                'Submit Task'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const TaskCard = ({ task }: { task: Task }) => {
        const isExpired = task.expiresAt && new Date(task.expiresAt) <= new Date();
        const timeRemaining = task.expiresAt && !isExpired ? 
            Math.max(0, new Date(task.expiresAt).getTime() - Date.now()) : 0;

        return (
            <div 
                className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer ${
                    task.status === 'available' && !isExpired ? 'hover:border-[#f97316]' : ''
                }`}
                onClick={() => handleTaskClick(task)}
            >
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{task.title}</h3>
                        {task.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
                        )}
                    </div>
                    <div className="ml-4 flex-shrink-0">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <DollarSign className="h-3 w-3 mr-1" />
                            {task.amount} SOL
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        Created {new Date(task.createdAt).toLocaleDateString()}
                    </div>

                    {task.status === 'available' && task.expiresAt && (
                        <div className="flex items-center">
                            {isExpired ? (
                                <span className="text-xs text-red-600 font-medium">Expired</span>
                            ) : (
                                <div className="flex items-center text-xs text-orange-600">
                                    <Clock className="h-3 w-3 mr-1" />
                                    <ClientOnly>
                                        <CountdownTimer 
                                            expiresAt={task.expiresAt} 
                                            onExpire={() => fetchAvailableTasks()}
                                            compact={true}
                                        />
                                    </ClientOnly>
                                </div>
                            )}
                        </div>
                    )}

                    {task.status === 'completed' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completed
                        </span>
                    )}

                    {task.status === 'paid' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Paid
                        </span>
                    )}

                    {task.status === 'pending' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                        </span>
                    )}
                </div>

                {task.status === 'available' && !isExpired && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                        <button className="w-full bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#ea580c] transition-colors flex items-center justify-center">
                            <Eye className="h-4 w-4 mr-2" />
                            View Task
                        </button>
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col gap-3 mb-6">
                    <div>
                        <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">Worker</div>
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Tasks</h1>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">Manage your available and completed tasks.</p>
                    </div>
                </div>
                
                <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm w-fit mb-6">
                    <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 text-white">
                        Available
                    </button>
                    <button className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50">
                        Completed
                    </button>
                </div>

                <div className="grid gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-pulse">
                            <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-gray-200 rounded w-full mb-3"></div>
                            <div className="flex justify-between">
                                <div className="h-4 bg-gray-200 rounded w-24"></div>
                                <div className="h-6 bg-gray-200 rounded w-16"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const currentTasks = activeTab === 'available' ? availableTasks : completedTasks;

    // Show task detail view if a task is selected
    if (selectedTask) {
        return (
            <ClientOnly>
                <TaskDetailView task={selectedTask} />
            </ClientOnly>
        );
    }

    return (
        <ClientOnly>
            <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
            <div className="flex flex-col gap-3 mb-6">
                <div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">Worker</div>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Tasks</h1>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">Manage your available and completed tasks.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm w-fit mb-6">
                <button
                    onClick={() => setActiveTab('available')}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs font-semibold transition-colors ${
                        activeTab === 'available'
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    Available ({availableTasks.length})
                </button>
                <button
                    onClick={() => setActiveTab('completed')}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs font-semibold transition-colors ${
                        activeTab === 'completed'
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    Completed ({completedTasks.length})
                </button>
            </div>

            {/* Task List */}
            {currentTasks.length === 0 ? (
                <div className="text-center py-12">
                    <div className="bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        {activeTab === 'available' ? (
                            <Eye className="h-8 w-8 text-gray-400" />
                        ) : (
                            <CheckCircle className="h-8 w-8 text-gray-400" />
                        )}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {activeTab === 'available' ? 'No available tasks' : 'No completed tasks'}
                    </h3>
                    <p className="text-sm text-gray-500">
                        {activeTab === 'available' 
                            ? 'Check back later for new tasks to complete'
                            : 'Complete tasks to see them here'
                        }
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {currentTasks.map((task) => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
            )}
        </div>
        </ClientOnly>
    );
};
