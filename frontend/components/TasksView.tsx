'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { BACKEND_URL } from '../utils';
import { lamportsToSol } from '../utils/convert';

interface Task {
    id: number;
    title: string;
    amount: string;
    status: string;
    createdAt: string;
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
            } catch (error) {
                console.error('Error fetching tasks:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTasks();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Your Tasks</h1>
            
            {tasks.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                    <div className="text-center text-gray-500">
                        <div className="mb-4">
                            <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-700 mb-2">No Tasks Yet</h2>
                        <p className="text-gray-600 mb-4">You haven't created any tasks yet. Go to "Create Task" to get started!</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tasks.map((task) => (
                        <div key={task.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                            <div className="p-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">{task.title}</h3>
                                
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-2xl font-bold text-purple-600">{lamportsToSol(task.amount, 1)} SOL</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                        task.status === 'completed' 
                                            ? 'bg-green-100 text-green-800' 
                                            : task.status === 'pending'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-blue-100 text-blue-800'
                                    }`}>
                                        {task.status}
                                    </span>
                                </div>
                                
                                <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                                    <span>{task.totalSubmissions} submissions</span>
                                    <span>{task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'No date'}</span>
                                </div>
                                
                                <div className="flex gap-2">
                                    {task.options.slice(0, 3).map((option, index) => (
                                        <div key={option.id} className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200">
                                            <img 
                                                src={option.imageUrl} 
                                                alt={`Option ${index + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ))}
                                    {task.options.length > 3 && (
                                        <div className="w-12 h-12 rounded-lg border border-gray-200 flex items-center justify-center bg-gray-100">
                                            <span className="text-xs text-gray-600">+{task.options.length - 3}</span>
                                        </div>
                                    )}
                                </div>
                                
                                <button 
                                    onClick={() => router.push(`/creator/task/${task.id}`)}
                                    className="mt-4 w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium"
                                >
                                    View Details
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
