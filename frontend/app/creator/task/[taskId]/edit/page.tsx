'use client';

import { Appbar } from '@/components/Appbar';
import { Footer } from '@/components/Footer';
import { ToastContainer } from '@/components/Toast';
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { BACKEND_URL } from '@/utils';
import { showToast } from '@/components/Toast';

interface Task {
    id: number;
    title: string;
    amount: string;
    status: string;
    createdAt: string;
    options: Array<{
        id: number;
        imageUrl: string;
    }>;
    expiresAt?: string;
}

export default function EditTaskPage() {
    const { publicKey } = useWallet();
    const { taskId } = useParams();
    const router = useRouter();
    const [userType, setUserType] = useState<'worker' | 'creator' | null>(null);
    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [expirationDate, setExpirationDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const checkWalletConnection = () => {
            if (publicKey) {
                const creatorToken = localStorage.getItem("token");
                const workerToken = localStorage.getItem("workerToken");
                
                if (creatorToken) {
                    setUserType('creator');
                } else if (workerToken) {
                    setUserType('worker');
                } else {
                    setUserType(null);
                }
            } else {
                setUserType(null);
            }
        };

        checkWalletConnection();
        const interval = setInterval(checkWalletConnection, 1000);
        return () => clearInterval(interval);
    }, [publicKey]);

    useEffect(() => {
        if (taskId && userType === 'creator') {
            fetchTask();
        }
    }, [taskId, userType]);

    const fetchTask = async () => {
        try {
            const token = localStorage.getItem("token");
            
            if (!token) {
                console.error('No authentication token found');
                showToast('Please sign in to edit tasks', 'error');
                router.push('/creator/dashboard');
                return;
            }
            
            const response = await axios.get(`${BACKEND_URL}/v1/user/task/${taskId}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            
            setTask(response.data);
            setTitle(response.data.title);
            if (response.data.expiresAt) {
                // Convert to datetime-local format
                const date = new Date(response.data.expiresAt);
                setExpirationDate(date.toISOString().slice(0, 16));
            }
        } catch (error: any) {
            console.error('Error fetching task:', error);
            
            if (error.response?.status === 401 || error.response?.status === 403) {
                showToast('Please sign in to edit tasks', 'error');
                router.push('/creator/dashboard');
            } else if (error.response?.status === 404) {
                showToast('Task not found', 'error');
                router.push('/creator/tasks');
            } else {
                showToast('Failed to load task', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const token = localStorage.getItem("token");
            
            if (!token) {
                showToast('Please sign in to update tasks', 'error');
                router.push('/creator/dashboard');
                return;
            }
            
            const updateData = {
                title,
                expirationDate: expirationDate || null
            };

            await axios.put(`${BACKEND_URL}/v1/user/task/${taskId}`, updateData, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });

            showToast('Task updated successfully!', 'success');
            router.push(`/creator/task/${taskId}`);
        } catch (error) {
            console.error('Error updating task:', error);
            showToast('Failed to update task', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (userType !== 'creator') {
        return (
            <div className="min-h-screen flex flex-col">
                <Appbar onUserTypeSelect={setUserType} />
                <div className="flex-grow pt-16 flex justify-center">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
                        <p className="text-gray-600">Please sign in as a creator to access this page.</p>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col">
                <ToastContainer />
                <Appbar onUserTypeSelect={setUserType} />
                <div className="flex-grow pt-16 flex justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f97316]"></div>
                </div>
                <Footer />
            </div>
        );
    }

    if (!task) {
        return (
            <div className="min-h-screen flex flex-col">
                <ToastContainer />
                <Appbar onUserTypeSelect={setUserType} />
                <div className="flex-grow pt-16 flex justify-center">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-800 mb-4">Task Not Found</h1>
                        <p className="text-gray-600">The task you're looking for doesn't exist.</p>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    if (task.status === 'completed') {
        return (
            <div className="min-h-screen flex flex-col">
                <ToastContainer />
                <Appbar onUserTypeSelect={setUserType} />
                <div className="flex-grow pt-16 flex justify-center">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-800 mb-4">Cannot Edit Task</h1>
                        <p className="text-gray-600">Only pending tasks can be edited.</p>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <ToastContainer />
            <Appbar onUserTypeSelect={setUserType} />
            <div className="flex-grow pt-16">
                <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
                    <div className="mb-6 sm:mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Edit Task</h1>
                        <p className="text-sm sm:text-base text-gray-600">Update your task details</p>
                    </div>

                    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 lg:p-8">
                        <div className="mb-6">
                            <label className="block text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">Task Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 placeholder-gray-500 transition-all text-sm sm:text-base"
                                placeholder="Enter a clear, descriptive title for your task..."
                                required
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">Expiration Date (Optional)</label>
                            <input
                                type="datetime-local"
                                value={expirationDate}
                                onChange={(e) => setExpirationDate(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 transition-all text-sm sm:text-base"
                                min={new Date(Date.now() + 3600000).toISOString().slice(0, 16)}
                            />
                            <p className="text-xs sm:text-sm text-gray-500 mt-2">Set when this task will expire. Workers won't see expired tasks.</p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">Current Options</label>
                            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4">
                                <div className="flex flex-wrap gap-2 sm:gap-4">
                                    {task.options.map((option, index) => (
                                        <div key={option.id} className="relative">
                                            <img className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg object-cover border border-gray-200 shadow-sm" src={option.imageUrl} alt={`Option ${index + 1}`} />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4">Note: Options cannot be changed after task creation</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`flex-1 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                                    isSubmitting
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-gray-900 text-white hover:bg-gray-800 shadow-md hover:shadow-lg'
                                }`}
                            >
                                {isSubmitting ? (
                                    <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    'Update Task'
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push(`/creator/task/${taskId}`)}
                                className="flex-1 px-4 sm:px-6 py-2 sm:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            <Footer />
        </div>
    );
}
