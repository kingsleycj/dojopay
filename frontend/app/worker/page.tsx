"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkerPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to dashboard by default
        router.push("/worker/dashboard");
    }, [router]);

    return (
        <div className="min-h-screen flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f97316]"></div>
        </div>
    );
}
