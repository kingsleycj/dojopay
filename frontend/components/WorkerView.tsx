"use client";
import { BACKEND_URL, CLOUDFRONT_URL } from "@/utils";
import axios from "axios";
import { useEffect, useState } from "react";
import { showToast } from "./Toast";
import { CountdownTimer } from "./CountdownTimer";

interface Task {
    id: number;
    amount: number;
    title: string;
    options: {
        id: number;
        image_url: string;
        task_id: number;
    }[];
    expiresAt?: string;
    createdAt: string;
}

export const WorkerView = () => {
    const [currentTask, setCurrentTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${BACKEND_URL}/v1/worker/nextTask`, {
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("workerToken")}`
                }
            });
            console.log("Worker nextTask response:", response.data);
            setCurrentTask(response.data.task);
        } catch (error) {
            setCurrentTask(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (localStorage.getItem("workerToken")) {
            fetchTasks();
        }
    }, []);
    
    if (loading) {
        return (
            <div className="h-screen flex justify-center items-center">
                <div className="w-full flex justify-center text-lg sm:text-2xl">
                    Loading...
                </div>
            </div>
        );
    }

    if (!currentTask) {
        return (
            <div className="min-h-screen flex flex-col">
                <div className="flex-grow pt-16">
                    <div className="max-w-screen-lg mx-auto p-4 sm:p-6">
                        <div className="text-center text-gray-500 mt-8 sm:mt-12">
                            <p className="text-base sm:text-lg">No tasks available at the moment</p>
                            <p className="text-sm sm:text-base mt-2">Check back later for new tasks</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <div className="flex-grow pt-16">
                <div className="max-w-screen-lg mx-auto p-4 sm:p-6">
                    {currentTask && (
                        <div className="mb-4 sm:mb-6">
                            <h2 className="text-xl sm:text-2xl font-bold text-black text-center mb-2">
                                {currentTask.title}
                            </h2>
                            <p className="text-sm sm:text-base text-center text-gray-600 mb-3">
                                Select your preferred option
                            </p>
                            {currentTask.expiresAt && (
                                <div className="flex justify-center mb-2">
                                    <CountdownTimer expiresAt={currentTask.expiresAt} onExpire={() => fetchTasks()} />
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6 sm:mb-8">
                        {currentTask?.options.map(option => (
                            <Option
                                onSelect={async () => {
                                    if (submitting) return;
                                    
                                    setSubmitting(true);
                                    try {
                                        await axios.post(`${BACKEND_URL}/v1/worker/submission`, {
                                            taskId: currentTask.id.toString(),
                                            selection: option.id.toString()
                                        }, {
                                            headers: {
                                                "Authorization": `Bearer ${localStorage.getItem("workerToken")}`
                                            }
                                        });
                                        showToast("Submission successful!", "success");
                                        await fetchTasks();
                                    } catch(e) {
                                        console.error("Submission failed:", e);
                                        showToast("Submission failed. Please try again.", "error");
                                        setCurrentTask(null);
                                    } finally {
                                        setSubmitting(false);
                                    }
                                }}
                                key={option.id} 
                                imageUrl={option.image_url} 
                            />
                        ))}
                    </div>
                    
                    {submitting && (
                        <div className="flex justify-center">
                            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 sm:px-6 py-3 sm:py-4 shadow-sm">
                                <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-purple-500 border-r-2 border-green-400"></div>
                                <span className="text-xs sm:text-sm sm:text-base text-gray-700 font-medium">Submitting your choice...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

function Option({imageUrl, onSelect}: {
    imageUrl: string;
    onSelect: () => void;
}) {
    const [hasError, setHasError] = useState(false);

    const handleImageError = () => {
        if (!hasError) {
            console.error('Image failed to load:', imageUrl);
            setHasError(true);
        }
    };

    if (hasError) {
        return <div className="p-2 sm:p-4 border rounded-lg m-1 sm:m-2 bg-white shadow-sm">
            <div className="p-2 sm:p-4 w-full max-w-xs sm:max-w-sm rounded-md border-2 border-gray-300 flex items-center justify-center bg-gray-100">
                <div className="text-center text-gray-500">
                    <div className="text-xs sm:text-sm">Image Not Available</div>
                </div>
            </div>
        </div>;
    }

    return <div className="p-2 sm:p-4 border rounded-lg m-1 sm:m-2 bg-white shadow-sm">
        <img 
            className={"p-1 sm:p-2 w-full max-w-xs sm:max-w-sm rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"} 
            src={imageUrl}
            onError={handleImageError}
            alt="Option"
            onClick={onSelect}
        />
    </div>;
}
