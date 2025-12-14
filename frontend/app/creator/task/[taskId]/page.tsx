"use client"
import { Appbar } from '@/components/Appbar';
import { Footer } from '@/components/Footer';
import { CreatorSidebar } from '@/components/CreatorSidebar';
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
        title?: string
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Appbar onUserTypeSelect={setUserType} />
            <div className="flex flex-grow pt-16">
                <CreatorSidebar activeView="tasks" onViewChange={() => {}} />
                <div className="flex-grow ml-64">
                    <div className='p-6'>
                        <button
                            onClick={() => router.push('/creator/tasks')}
                            className='border border-black text-black px-4 py-2 rounded font-bold hover:bg-gray-100 flex items-center gap-2 transition-colors'>
                            ← Back to Tasks
                        </button>
                    </div>
                    <div className='text-2xl pt-4 flex justify-center text-black font-semibold'>
                        {taskDetails.title}
                    </div>
                    <div className='flex justify-center pt-8'>
                        {Object.keys(result || {}).map((taskId, index) => <Task key={taskId} index={index + 1} imageUrl={result[taskId].option.imageUrl} votes={result[taskId].count} />)}
                    </div>

                    <div className='flex justify-center pt-8 px-4'>
                        <div className='w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8'>
                            {/* Analytics Section */}
                            <div>
                                <h2 className='text-xl font-bold mb-4 text-black'>Analytics</h2>
                                <div className='space-y-4'>
                                    {Object.keys(result || {}).map((taskId, index) => {
                                        const totalVotes = Object.values(result || {}).reduce((acc, curr) => acc + curr.count, 0);
                                        const votes = result[taskId].count;
                                        const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : "0";

                                        return <div key={taskId} className='bg-white border p-4 rounded-lg shadow-sm'>
                                            <div className='flex items-center justify-between mb-2'>
                                                <span className='font-bold text-gray-700'>Option {index + 1}</span>
                                                <span className='bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded'>{percentage}%</span>
                                            </div>
                                            <div className='w-full bg-gray-200 rounded-full h-2.5'>
                                                <div className='bg-blue-600 h-2.5 rounded-full' style={{ width: `${percentage}%` }}></div>
                                            </div>
                                            <div className='mt-2 text-sm text-gray-600 font-medium'>
                                                {votes} Votes
                                            </div>
                                        </div>
                                    })}
                                </div>
                            </div>

                            {/* Submissions Section */}
                            <div>
                                <h2 className='text-xl font-bold mb-4 text-black'>Submissions</h2>
                                <div className='bg-white border text-black rounded p-4 shadow-sm'>
                                    <table className='w-full text-left'>
                                        <thead>
                                            <tr className='border-b border-gray-200'>
                                                <th className='p-2 font-semibold'>Worker Address</th>
                                                <th className='p-2 font-semibold'>Option Selected</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {submissions
                                                .slice((currentPage - 1) * submissionsPerPage, currentPage * submissionsPerPage)
                                                .map((sub, i) => {
                                                    // Find option index (1-based)
                                                    const optionKeys = Object.keys(result || {});
                                                    const optionIndex = optionKeys.indexOf(sub.optionId.toString()) + 1;

                                                    return <tr key={i} className='border-b border-gray-200 last:border-0 hover:bg-gray-50'>
                                                        <td className='p-2 font-mono text-gray-700'>{sub.workerAddress}</td>
                                                        <td className='p-2 text-gray-700'>Option {optionIndex > 0 ? optionIndex : sub.optionId}</td>
                                                    </tr>
                                                })}
                                        </tbody>
                                    </table>
                                    
                                    {/* Pagination */}
                                    {submissions.length > submissionsPerPage && (
                                        <div className='flex justify-center items-center gap-2 mt-4 pt-4 border-t border-gray-200'>
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                disabled={currentPage === 1}
                                                className='px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                                            >
                                                Previous
                                            </button>
                                            <span className='text-sm text-gray-600'>
                                                Page {currentPage} of {Math.ceil(submissions.length / submissionsPerPage)}
                                            </span>
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(submissions.length / submissionsPerPage)))}
                                                disabled={currentPage === Math.ceil(submissions.length / submissionsPerPage)}
                                                className='px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}

function Task({ imageUrl, votes, index }: {
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
        return <div className='flex flex-col items-center p-4 border rounded-lg m-2 bg-white shadow-sm'>
            <div className='w-full text-left font-bold text-sm mb-2 text-gray-500'>Option {index}</div>
            <div className="p-2 w-full max-w-xs rounded-md border-2 border-gray-300 flex items-center justify-center bg-gray-100">
                <div className="text-center text-gray-500">
                    <div className="text-sm">Image Not Available</div>
                </div>
            </div>
            <div className='mt-2 font-bold text-lg text-black'>
                {votes} Votes
            </div>
        </div>;
    }

    return <div className='flex flex-col items-center p-4 border rounded-lg m-2 bg-white shadow-sm'>
        <div className='w-full text-left font-bold text-sm mb-2 text-gray-500'>Option {index}</div>
        <img 
            className={"p-2 w-full max-w-xs rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"} 
            src={imageUrl}
            onError={handleImageError}
            alt={`Option ${index}`} 
        />
        <div className='mt-2 font-bold text-lg text-black'>
            {votes} Votes
        </div>
    </div>;
}
