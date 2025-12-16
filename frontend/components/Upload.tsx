"use client";
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { UploadImage } from "@/components/UploadImage";
import { BACKEND_URL } from "@/utils";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { showToast } from "./Toast";

export const Upload = () => {
    const [images, setImages] = useState<string[]>([]);
    const [title, setTitle] = useState("");
    const [txSignature, setTxSignature] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [expirationDate, setExpirationDate] = useState("");
    const router = useRouter();
    const { publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();

    async function onSubmit() {
        if (isSubmitting) return;
        setIsSubmitting(true);
        
        try {
            const token = localStorage.getItem("token");
            console.log("Token from localStorage:", token);
            
            if (!token) {
                showToast("Please sign in first", "error");
                setIsSubmitting(false);
                return;
            }
            
            // If backend is not running, allow data URLs for submission
            // Otherwise, only send uploaded images
            const uploadedImages = images.filter(img => !img.startsWith('data:'));
            const allImages = uploadedImages.length > 0 ? uploadedImages : images;
            
            if (allImages.length === 0) {
                showToast("Please add at least one image before submitting", "error");
                setIsSubmitting(false);
                return;
            }
            
            const requestData = {
                options: allImages.map(image => ({
                    imageUrl: image,
                })),
                title,
                signature: txSignature,
                expirationDate: expirationDate || null
            };
            
            console.log("Submitting task with data:", requestData);
            
            const response = await axios.post(`${BACKEND_URL}/v1/user/task`, requestData, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });

            console.log("Task submission response:", response.data);
            showToast("Task submitted successfully!", "success");
            router.push(`/creator/task/${response.data.id}`)
        } catch (error) {
            console.error("Failed to submit task:", error);
            if (axios.isAxiosError(error)) {
                console.error("Axios error details:", {
                    message: error.message,
                    response: error.response?.data,
                    status: error.response?.status,
                    config: {
                        url: error.config?.url,
                        method: error.config?.method,
                        headers: error.config?.headers
                    }
                });
            }
            showToast("Failed to submit task. Please try again.", "error");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function makePayment() {
        if (isSubmitting) return;
        setIsSubmitting(true);
        
        try {
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey!,
                    toPubkey: new PublicKey("FPDb9L6L3kyBiw8LeXCcdza85PbSNxcZujXNkPrwEont"),
                    lamports: 100000000,
                })
            );

            const {
                context: { slot: minContextSlot },
                value: { blockhash, lastValidBlockHeight }
            } = await connection.getLatestBlockhashAndContext();

            const signature = await sendTransaction(transaction, connection, { minContextSlot });
            console.log("Transaction signature:", signature);

            const confirmation = await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
            console.log("Transaction confirmation:", confirmation);

            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${confirmation.value.err}`);
            }

            setTxSignature(signature);
            showToast("Payment successful! Now you can submit the task.", "success");
            setShowPaymentModal(false);
            
            // Wait a bit to ensure transaction is fully propagated
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error("Payment failed:", error);
            showToast("Payment failed. Please try again.", "error");
        } finally {
            setIsSubmitting(false);
        }
    }

    return <div className="w-full">
        {/* Task Title Section */}
        <div className="mb-6 sm:mb-8">
            <label className="block text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">Task Title</label>
            <input 
                onChange={(e) => setTitle(e.target.value)} 
                type="text" 
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-500 transition-all text-sm sm:text-base" 
                placeholder="Enter a clear, descriptive title for your task..." 
                required 
            />
        </div>

        {/* Expiration Date Section */}
        <div className="mb-6 sm:mb-8">
            <label className="block text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">Expiration Date (Optional)</label>
            <input 
                onChange={(e) => setExpirationDate(e.target.value)} 
                type="datetime-local" 
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 transition-all text-sm sm:text-base" 
                min={new Date(Date.now() + 3600000).toISOString().slice(0, 16)} // Minimum 1 hour from now
            />
            <p className="text-xs sm:text-sm text-gray-500 mt-2">Set when this task will expire. Workers won't see expired tasks.</p>
        </div>

        {/* Images Section */}
        <div className="mb-6 sm:mb-8">
            <label className="block text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">Task Images</label>
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6">
                <div className="flex flex-wrap gap-2 sm:gap-4">
                    {images.map((image, index) => (
                        <div key={index} className="relative group">
                            <img className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg object-cover border border-gray-200 shadow-sm" src={image} alt="Task option" />
                            <button
                                onClick={() => setImages(images.filter((_, i) => i !== index))}
                                className="absolute -top-2 -right-2 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs sm:text-sm"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <UploadImage 
                        onImageAdded={(imageUrl) => setImages(i => [...i, imageUrl])} 
                    />
                </div>
                <p className="text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4">Add images that workers will choose from when completing your task</p>
            </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-center">
            <button 
                onClick={txSignature ? onSubmit : () => setShowPaymentModal(true)} 
                disabled={isSubmitting || !title.trim() || images.length === 0}
                className={`px-6 sm:px-8 py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                    isSubmitting || !title.trim() || images.length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg'
                }`}
            > 
                {isSubmitting ? (
                    <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : txSignature ? (
                    "Submit Task"
                ) : (
                    "Create Task"
                )}
            </button>
        </div>

        {/* Payment Confirmation Modal */}
        {showPaymentModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full mx-4">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Confirm Payment</h3>
                    <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                        Creating a task requires a payment of <span className="font-semibold text-purple-600">0.1 SOL</span>. 
                        This payment covers the task creation and worker rewards.
                    </p>
                    <div className="flex gap-2 sm:gap-3">
                        <button
                            onClick={() => setShowPaymentModal(false)}
                            className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={makePayment}
                            disabled={isSubmitting}
                            className={`flex-1 px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                                isSubmitting
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                        >
                            {isSubmitting ? 'Processing...' : 'Pay 0.1 SOL'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
}