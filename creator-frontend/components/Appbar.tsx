"use client";
import {
    WalletDisconnectButton,
    WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '@/utils';

export const Appbar = () => {
    const { publicKey, signMessage } = useWallet();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    async function signAndSend() {
        if (!publicKey) {
            return;
        }
        if (localStorage.getItem("token")) {
            return;
        }
        try {
            const message = new TextEncoder().encode("Sign into mechanical turks");
            const signature = await signMessage?.(message);
            console.log(signature)
            console.log(publicKey)
            const response = await axios.post(`${BACKEND_URL}/v1/user/signin`, {
                signature,
                publicKey: publicKey?.toString()
            });

            localStorage.setItem("token", response.data.token);
        } catch (error) {
            console.error("Backend signin failed:", error);
            // Don't crash the app if backend is not available
        }
    }

    useEffect(() => {
        if (mounted) {
            signAndSend()
        }
    }, [publicKey, mounted]);

    if (!mounted) {
        return <div className="flex justify-between border-b pb-2 pt-2">
            <div className="text-2xl pl-4 flex justify-center pt-3">
                DojoPay
            </div>
            <div className="text-xl pr-4 pb-2">
                <div className="w-20 h-10 bg-gray-200 rounded animate-pulse"></div>
            </div>
        </div>
    }

    return <div className="flex justify-between border-b pb-2 pt-2">
        <div className="text-2xl pl-4 flex justify-center pt-3">
            DojoPay
        </div>
        <div className="text-xl pr-4 pb-2">
            {publicKey ? <WalletDisconnectButton /> : <WalletMultiButton />}
        </div>
    </div>
}