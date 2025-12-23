"use client";

import { useState } from "react";
import { showToast } from "@/components/Toast";
import { lamportsToSol } from "@/utils/convert";
import { Clock, DollarSign, ArrowLeft, Upload, CheckCircle } from "lucide-react";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Task } from "@/types/worker";

interface TaskDetailProps {
    task: Task;
    onBack: () => void;
    onSubmit: (taskId: number, selection: number) => Promise<void>;
}

export const TaskDetailView = ({ task, onBack, onSubmit }: TaskDetailProps) => {
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const isExpired = task.expiresAt && new Date(task.expiresAt) <= new Date();

    const handleOptionSelect = (optionId: number) => {
        if (isExpired) return;
        setSelectedOption(optionId);
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploading(true);
            const reader = new FileReader();
            reader.onload = (e) => {
                setUploadedImage(e.target?.result as string);
                setUploading(false);
            };
            reader.onerror = () => {
                showToast("Failed to upload image", "error");
                setUploading(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (isExpired) {
            showToast("This task has expired", "error");
            return;
        }

        if (!selectedOption && !uploadedImage) {
            showToast("Please select an option or upload an image", "error");
            return;
        }

        setSubmitting(true);
        try {
            // If we have options, submit the selected option
            if (selectedOption !== null) {
                await onSubmit(task.id, selectedOption);
            }
            // If we have an uploaded image, handle image submission (would need different API)
            else if (uploadedImage) {
                // This would be for image-based tasks
                showToast("Image submission feature coming soon", "info");
                return;
            }
        } catch (error: any) {
            console.error("Submission failed:", error);
            showToast(error.response?.data?.message || "Submission failed. Please try again.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to tasks
                </button>
                
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">{task.title}</h1>
                            {task.description && (
                                <p className="text-gray-600 leading-relaxed">{task.description}</p>
                            )}
                        </div>
                        <div className="ml-6 flex-shrink-0">
                            <div className="bg-green-100 border border-green-200 rounded-lg px-4 py-2">
                                <div className="flex items-center text-green-800">
                                    <DollarSign className="h-5 w-5 mr-1" />
                                    <span className="font-semibold">{task.amount} SOL</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {task.expiresAt && (
                        <div className="flex items-center text-orange-600">
                            <Clock className="h-5 w-5 mr-2" />
                            <span className="font-medium">
                                {isExpired ? 'Task expired' : 'Time remaining:'}
                            </span>
                            {!isExpired && (
                                <span className="ml-2">
                                    <CountdownTimer 
                                        expiresAt={task.expiresAt} 
                                        onExpire={() => {
                                            showToast("This task has expired", "error");
                                        }}
                                    />
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Task Content */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Task Options</h2>

                {/* Options Grid */}
                {task.options && task.options.length > 0 && (
                    <div className="mb-6">
                        <p className="text-sm text-gray-600 mb-4">Select your preferred option:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {task.options.map((option) => (
                                <div
                                    key={option.id}
                                    onClick={() => handleOptionSelect(option.id)}
                                    className={`relative rounded-lg border-2 p-4 cursor-pointer transition-all ${
                                        selectedOption === option.id
                                            ? 'border-[#f97316] bg-orange-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                    } ${isExpired ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {selectedOption === option.id && (
                                        <div className="absolute top-2 right-2">
                                            <CheckCircle className="h-5 w-5 text-[#f97316]" />
                                        </div>
                                    )}
                                    
                                    {option.image_url || option.imageUrl ? (
                                        <div className="aspect-video mb-3">
                                            <img
                                                src={option.image_url || option.imageUrl}
                                                alt={`Option ${option.id}`}
                                                className="w-full h-full object-cover rounded-lg"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                    const placeholder = target.nextElementSibling as HTMLElement;
                                                    if (placeholder) placeholder.style.display = 'flex';
                                                }}
                                            />
                                            <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center" style={{ display: 'none' }}>
                                                <span className="text-gray-500 text-sm">Option {option.id}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                                            <span className="text-gray-500 text-sm">Option {option.id}</span>
                                        </div>
                                    )}
                                    
                                    <p className="text-sm font-medium text-gray-900">Option {option.id}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Image Upload Section */}
                {!task.options || task.options.length === 0 ? (
                    <div className="mb-6">
                        <p className="text-sm text-gray-600 mb-4">Upload your submission:</p>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                            <div className="text-center">
                                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <div className="flex text-sm text-gray-600">
                                    <label
                                        htmlFor="file-upload"
                                        className="relative cursor-pointer bg-white rounded-md font-medium text-[#f97316] hover:text-[#ea580c] focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[#f97316]"
                                    >
                                        <span>Upload a file</span>
                                        <input
                                            id="file-upload"
                                            name="file-upload"
                                            type="file"
                                            className="sr-only"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            disabled={!!isExpired}
                                        />
                                    </label>
                                    <p className="pl-1">or drag and drop</p>
                                </div>
                                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                            </div>

                            {uploadedImage && (
                                <div className="mt-4">
                                    <div className="relative inline-block">
                                        <img
                                            src={uploadedImage}
                                            alt="Uploaded"
                                            className="max-w-full h-auto rounded-lg max-h-64"
                                        />
                                        <button
                                            onClick={() => setUploadedImage(null)}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}

                {/* Submit Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !!isExpired || (!selectedOption && !uploadedImage)}
                        className="bg-[#f97316] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#ea580c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                        {submitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Submitting...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Submit Task
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
