"use client"
import { Appbar } from '@/components/Appbar';
import { ApplicationFooter } from '@/components/ApplicationFooter';
import { CreatorSidebar } from '@/components/CreatorSidebar';
import { CountdownTimer } from '@/components/CountdownTimer';
import { BACKEND_URL, CLOUDFRONT_URL } from '@/utils';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';

async function getTaskDetails(taskId: string) {
    const response = await axios.get(`${BACKEND_URL}/v1/user/task?taskId=${taskId}`, {
        headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
    })
    return response.data
}

export default function CreatorTaskDetailPage({ params }: {
    params: { taskId: string }
}) {
    const [result, setResult] = useState<Record<string, {
        count: number;
        option: {
            imageUrl: string
        }
    }>>({});
    const [taskDetails, setTaskDetails] = useState<{
        title?: string;
        expiresAt?: string | null;
    }>({});
    const [submissions, setSubmissions] = useState<Array<{
        workerId: number;
        workerAddress: string;
        optionId: number;
        amount: number;
    }>>([]);
    const [userType, setUserType] = useState<'worker' | 'creator' | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const submissionsPerPage = 10;
    const router = useRouter();
    const { publicKey } = useWallet();

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
        if (userType === 'creator') {
            getTaskDetails(params.taskId)
                .then((data) => {
                    setResult(data.result)
                    setTaskDetails(data.taskDetails)
                    setSubmissions(data.submissions || [])
                })
                .finally(() => {
                    setLoading(false);
                })
        }
    }, [params.taskId, userType]);

    if (loading || userType !== 'creator') {
        return (
            <div className="min-h-screen flex flex-col">
                <Appbar onUserTypeSelect={setUserType} />
                <div className="flex-grow flex justify-center items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f97316]"></div>
                </div>
                <ApplicationFooter />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Appbar onUserTypeSelect={setUserType} />
            <div className="flex flex-grow pt-16">
                <CreatorSidebar activeView="tasks" onViewChange={() => {}} />
                <div className="flex-grow ml-64">
                    <div className="max-w-6xl mx-auto p-6">
                        {/* Header Section */}
                        <div className="mb-8">
                            <button
                                onClick={() => router.push('/creator/tasks')}
                                className='inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4 group'>
                                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                <span className="font-medium">Back to Tasks</span>
                            </button>
                            
                            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex-1">
                                        <h1 className="text-3xl font-bold text-gray-900 mb-3">{taskDetails.title}</h1>
                                        {taskDetails.expiresAt && (
                                            <div className="mb-4">
                                                <CountdownTimer expiresAt={taskDetails.expiresAt} compact={true} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => router.push(`/creator/task/${params.taskId}/edit`)}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-sm">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Edit Task
                                        </button>
                                    </div>
                                </div>

                                {/* Task Options Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                    {Object.keys(result || {}).map((taskId, index) => (
                                        <TaskCard key={taskId} index={index + 1} imageUrl={result[taskId].option.imageUrl} votes={result[taskId].count} />
                                    ))}
                                </div>

                                {/* Analytics and Submissions Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Analytics Section */}
                                    <div className="bg-gray-50 rounded-xl p-6">
                                        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                            <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            Analytics
                                        </h2>
                                        <div className="space-y-4">
                                            {Object.keys(result || {}).map((taskId, index) => {
                                                const totalVotes = Object.values(result || {}).reduce((acc, curr) => acc + curr.count, 0);
                                                const votes = result[taskId].count;
                                                const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : "0";

                                                return (
                                                    <div key={taskId} className='bg-white p-4 rounded-lg border border-gray-200'>
                                                        <div className='flex items-center justify-between mb-3'>
                                                            <span className='font-semibold text-gray-800'>Option {index + 1}</span>
                                                            <span className='bg-[#fff7ed] text-gray-900 text-sm font-medium px-3 py-1 rounded-full border border-[#fed7aa]'>
                                                                {percentage}%
                                                            </span>
                                                        </div>
                                                        <div className='w-full bg-gray-200 rounded-full h-3 overflow-hidden'>
                                                            <div 
                                                                className='bg-[#f97316] h-3 rounded-full transition-all duration-500 ease-out' 
                                                                style={{ width: `${percentage}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className='mt-2 text-sm text-gray-600 font-medium'>
                                                            {votes} {votes === 1 ? 'Vote' : 'Votes'}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Submissions Section */}
                                    <div className="bg-gray-50 rounded-xl p-6">
                                        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                            <svg className="w-5 h-5 text-[#f97316]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                            </svg>
                                            Submissions ({submissions.length})
                                        </h2>
                                        <div className='bg-white rounded-lg border border-gray-200 overflow-hidden'>
                                            {submissions.length === 0 ? (
                                                <div className="p-8 text-center text-gray-500">
                                                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                                    </svg>
                                                    <p>No submissions yet</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="max-h-96 overflow-y-auto">
                                                        <table className='w-full'>
                                                            <thead className='bg-gray-50 border-b border-gray-200 sticky top-0'>
                                                                <tr>
                                                                    <th className='p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Worker Address</th>
                                                                    <th className='p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Option</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className='divide-y divide-gray-200'>
                                                                {submissions
                                                                    .slice((currentPage - 1) * submissionsPerPage, currentPage * submissionsPerPage)
                                                                    .map((sub, i) => {
                                                                        const optionKeys = Object.keys(result || {});
                                                                        const optionIndex = optionKeys.indexOf(sub.optionId.toString()) + 1;

                                                                        return (
                                                                            <tr key={i} className='hover:bg-gray-50 transition-colors'>
                                                                                <td className='p-4'>
                                                                                    <div className='font-mono text-sm text-gray-900 bg-gray-50 px-2 py-1 rounded'>
                                                                                        {sub.workerAddress.slice(0, 6)}...{sub.workerAddress.slice(-4)}
                                                                                    </div>
                                                                                </td>
                                                                                <td className='p-4'>
                                                                                    <span className='inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#fff7ed] text-gray-900 border border-[#fed7aa]'>
                                                                                        Option {optionIndex > 0 ? optionIndex : sub.optionId}
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    
                                                    {/* Pagination */}
                                                    {submissions.length > submissionsPerPage && (
                                                        <div className='flex justify-center items-center gap-2 p-4 border-t border-gray-200'>
                                                            <button
                                                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                                disabled={currentPage === 1}
                                                                className='px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                                                            >
                                                                Previous
                                                            </button>
                                                            <span className='text-sm text-gray-600'>
                                                                Page {currentPage} of {Math.ceil(submissions.length / submissionsPerPage)}
                                                            </span>
                                                            <button
                                                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(submissions.length / submissionsPerPage)))}
                                                                disabled={currentPage === Math.ceil(submissions.length / submissionsPerPage)}
                                                                className='px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
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
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ApplicationFooter />
        </div>
    );
}

function TaskCard({ imageUrl, votes, index }: {
    imageUrl: string;
    votes: number;
    index: number;
}) {
    const [hasError, setHasError] = useState(false);

    const handleImageError = () => {
        if (!hasError) {
            console.error('Image failed to load:', imageUrl);
            setHasError(true);
        }
    };

    if (hasError) {
        return (
            <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow'>
                <div className='aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center'>
                    <div className="text-center">
                        <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div className="text-sm text-gray-500">Image Not Available</div>
                    </div>
                </div>
                <div className='p-4'>
                    <div className='text-sm font-medium text-gray-500 mb-2'>Option {index}</div>
                    <div className='flex items-center justify-between'>
                        <span className='text-lg font-bold text-gray-900'>{votes}</span>
                        <span className='text-sm text-gray-500'>{votes === 1 ? 'Vote' : 'Votes'}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 group'>
            <div className='aspect-square overflow-hidden bg-gray-50'>
                <img 
                    className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300' 
                    src={imageUrl}
                    onError={handleImageError}
                    alt={`Option ${index}`} 
                />
            </div>
            <div className='p-4'>
                <div className='text-sm font-medium text-gray-500 mb-2'>Option {index}</div>
                <div className='flex items-center justify-between'>
                    <span className='text-lg font-bold text-gray-900'>{votes}</span>
                    <span className='text-sm text-gray-500'>{votes === 1 ? 'Vote' : 'Votes'}</span>
                </div>
            </div>
        </div>
    );
}
