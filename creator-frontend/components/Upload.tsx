"use client";
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { UploadImage } from "@/components/UploadImage";
import { BACKEND_URL } from "@/utils";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { showToast } from "@/components/Toast";

export const Upload = () => {
    const [images, setImages] = useState<string[]>([]);
    const [title, setTitle] = useState("");
    const [txSignature, setTxSignature] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const router = useRouter();

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
                signature: txSignature
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
            router.push(`/task/${response.data.id}`)
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
        } catch (error) {
            console.error("Payment failed:", error);
            showToast("Payment failed. Please try again.", "error");
        } finally {
            setIsSubmitting(false);
        }
    }

    return <div className="flex justify-center">
        <div className="max-w-screen-lg w-full">
            <div className="text-2xl text-left pt-20 w-full pl-4">
                Create a task
            </div>

            <label className="pl-4 block mt-2 text-md font-medium text-gray-900 text-black">Task details</label>

            <input onChange={(e) => {
                setTitle(e.target.value);
            }} type="text" id="first_name" className="ml-4 mt-1 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="What is your task?" required />

            <label className="pl-4 block mt-8 text-md font-medium text-gray-900 text-black">Add Images</label>
            <div className="flex justify-center pt-4 max-w-screen-lg flex-wrap gap-4">
                {images.map((image, index) => (
                    <div key={index} className="relative">
                        <img className="p-2 w-40 h-40 rounded object-cover" src={image} alt="Upload" />
                    </div>
                ))}
                <UploadImage onImageAdded={(imageUrl) => {
                    setImages(i => [...i, imageUrl]);
                }} />
            </div>

        <div className="flex justify-center">
            <button 
                onClick={txSignature ? onSubmit : makePayment} 
                type="button" 
                disabled={isSubmitting || (!txSignature && !publicKey)}
                className="mt-4 text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-full text-sm px-5 py-2.5 me-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {isSubmitting ? (
                    <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {txSignature ? "Submitting..." : "Processing..."}
                    </>
                ) : (
                    txSignature ? "Submit Task" : "Pay 0.1 SOL"
                )}
            </button>
        </div>
        
      </div>
    </div>
}