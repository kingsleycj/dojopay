'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { BACKEND_URL } from '../utils';
import { lamportsToSol } from '../utils/convert';
import { CountdownTimer } from './CountdownTimer';

interface Task {
    id: number;
    title: string;
    amount: string;
    status: string;
    createdAt: string;
    expiresAt: string | null;
    totalSubmissions: number;
    options: Array<{
        id: number;
        imageUrl: string;
    }>;
}

export const TasksView = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get(`${BACKEND_URL}/v1/user/tasks`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                setTasks(response.data.tasks);
            } catch (error: any) {
                console.error('Error fetching tasks:', error);
                // If authentication fails, clear token and redirect to landing page
                if (error.response?.status === 401 || error.response?.status === 403) {
                    console.log('Tasks authentication failed, clearing token and redirecting');
                    localStorage.removeItem('token');
                    localStorage.removeItem('workerToken');
                    window.location.href = '/';
                }
            } finally {
                setLoading(false);
            }
        };

        fetchTasks();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f97316]"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-3 sm:p-4 lg:p-6">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-3 sm:mb-4 lg:mb-6">Your Tasks</h1>
            
            {tasks.length === 0 ? (
                <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 lg:p-8">
                    <div className="text-center text-gray-500">
                        <div className="mb-3 sm:mb-4">
                            <svg className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-700 mb-2">No Tasks Yet</h2>
                        <p className="text-sm sm:text-base text-gray-600 mb-4">You haven't created any tasks yet. Go to "Create Task" to get started!</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                    {tasks.map((task) => (
                        <div key={task.id} className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow relative">
                            <div className="p-3 sm:p-4 lg:p-6 pt-4 sm:pt-5 flex flex-col h-full">
                                {/* Timer and ID on same line above title */}
                                <div className="mb-2 flex justify-between items-center">
                                    <span className="text-xs sm:text-sm text-gray-500 font-medium">ID: #{task.id}</span>
                                    {task.expiresAt && (
                                        <CountdownTimer expiresAt={task.expiresAt} />
                                    )}
                                </div>
                                
                                {/* Title with fixed height and proper truncation */}
                                <div className="mb-3 min-h-[2.5rem] sm:min-h-[3rem]">
                                    <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800 line-clamp-2 leading-tight" title={task.title}>
                                        {task.title.length > 60 ? task.title.substring(0, 60) + '...' : task.title}
                                    </h3>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
                                    <span className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900">{lamportsToSol(task.amount)} SOL</span>
                                    <span className={`inline-block px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                                        task.status === 'completed' 
                                            ? 'bg-green-100 text-green-800' 
                                            : task.status === 'pending'
                                            ? 'bg-[#fff7ed] text-gray-900 border border-[#fed7aa]'
                                            : 'bg-gray-100 text-gray-900'
                                    }`}>
                                        {task.status}
                                    </span>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                                    <span>{task.totalSubmissions} submissions</span>
                                    <span>{task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'No date'}</span>
                                </div>
                                
                                {/* Image previews with consistent height */}
                                <div className="flex gap-2 mb-3 sm:mb-4 min-h-[3rem] sm:min-h-[3rem]">
                                    {task.options.slice(0, 3).map((option, index) => (
                                        <div key={option.id} className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                                            <img 
                                                src={option.imageUrl} 
                                                alt={`Option ${index + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ))}
                                    {task.options.length > 3 && (
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border border-gray-200 flex items-center justify-center bg-gray-100 flex-shrink-0">
                                            <span className="text-xs text-gray-600">+{task.options.length - 3}</span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Action buttons - always at bottom */}
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-auto">
                                    <button
                                        onClick={() => router.push(`/creator/task/${task.id}`)}
                                        className="flex-1 px-3 sm:px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-xs sm:text-sm font-medium"
                                    >
                                        View Details
                                    </button>
                                    {task.status === 'pending' && (
                                        <button
                                            onClick={() => router.push(`/creator/task/${task.id}/edit`)}
                                            className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm font-medium"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
