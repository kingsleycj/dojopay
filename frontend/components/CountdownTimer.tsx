'use client';

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
    expiresAt: string | null;
    onExpire?: () => void;
}

export const CountdownTimer = ({ expiresAt, onExpire }: CountdownTimerProps) => {
    const [timeLeft, setTimeLeft] = useState<{
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        expired: boolean;
    }>({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        expired: false
    });

    useEffect(() => {
        if (!expiresAt) return;

        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const expiry = new Date(expiresAt).getTime();
            const difference = expiry - now;

            if (difference <= 0) {
                if (onExpire) onExpire();
                return {
                    days: 0,
                    hours: 0,
                    minutes: 0,
                    seconds: 0,
                    expired: true
                };
            }

            return {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((difference % (1000 * 60)) / 1000),
                expired: false
            };
        };

        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        setTimeLeft(calculateTimeLeft());

        return () => clearInterval(timer);
    }, [expiresAt, onExpire]);

    if (!expiresAt) {
        return null;
    }

    if (timeLeft.expired) {
        return (
            <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Expired
            </div>
        );
    }

    const formatNumber = (num: number) => num.toString().padStart(2, '0');

    return (
        <div className="flex items-center gap-1 text-xs text-gray-600">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            {timeLeft.days > 0 && (
                <span>{formatNumber(timeLeft.days)}d</span>
            )}
            {timeLeft.hours > 0 && (
                <span>{formatNumber(timeLeft.hours)}h</span>
            )}
            {timeLeft.minutes > 0 && (
                <span>{formatNumber(timeLeft.minutes)}m</span>
            )}
            <span>{formatNumber(timeLeft.seconds)}s</span>
        </div>
    );
};
