"use client";
import {
  WalletDisconnectButton,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "@/utils";
import { UserTypeModal } from "./UserTypeModal";
import { MobileMenu } from "./MobileMenu";
import { showToast } from "./Toast";
import { lamportsToSol } from "@/utils/convert";

export const Appbar = ({
  onUserTypeSelect,
}: {
  onUserTypeSelect: (type: "creator" | "worker") => void;
}) => {
  const { publicKey, signMessage } = useWallet();
  const [mounted, setMounted] = useState(false);
  const prevConnectedRef = useRef(false);
  const [showUserTypeModal, setShowUserTypeModal] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userType, setUserType] = useState<"creator" | "worker" | null>(null);
  const [workerEarnings, setWorkerEarnings] = useState<{ pendingAmount: string; lockedAmount: string } | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Determine user type from tokens
    const hasCreatorToken = localStorage.getItem("token");
    const hasWorkerToken = localStorage.getItem("workerToken");
    if (hasCreatorToken) {
      setUserType("creator");
    } else if (hasWorkerToken) {
      setUserType("worker");
    }
  }, [publicKey]);

async function signAndSend(): Promise<boolean> {
    if (!publicKey) {
        return false;
    }
    if (localStorage.getItem("token")) {
        return true;
    }
    setSigningIn(true);
    try {
        const message = new TextEncoder().encode("Sign into DojoPay as a creator");
        const signature = await signMessage?.(message);
        const response = await axios.post(`${BACKEND_URL}/v1/user/signin`, {
            signature,
            publicKey: publicKey?.toString()
        });
        localStorage.setItem("token", response.data.token);
        return true;
    } catch (error) {
        console.error("Backend signin failed:", error);
        return false;
    } finally {
        setSigningIn(false);
    }
}

async function signAndSendWorker(): Promise<boolean> {
    if (!publicKey) {
        return false;
    }
    if (localStorage.getItem("workerToken")) {
        return true;
    }
    setSigningIn(true);
    try {
        console.log("Attempting worker signin with publicKey:", publicKey.toString());
        const message = new TextEncoder().encode("Sign into DojoPay as a worker");
        console.log("Message to sign:", message);
        
        if (!signMessage) {
            console.error("signMessage function not available");
            return false;
        }
        
        // Add a small delay to ensure wallet is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const signature = await signMessage?.(message);
        console.log("Signature received:", signature);
        console.log("Signature type:", typeof signature);
        console.log("Signature constructor:", signature?.constructor?.name);
        console.log("Signature length:", signature?.length);
        console.log("Is array:", Array.isArray(signature));
        
        if (!signature) {
            console.error("No signature received from wallet");
            return false;
        }
        
        const response = await axios.post(`${BACKEND_URL}/v1/worker/signin`, {
            signature,
            publicKey: publicKey?.toString()
        });
        localStorage.setItem("workerToken", response.data.token);
        return true;
    } catch (error) {
        console.error("Backend worker signin failed:", error);
        // Add more specific error logging
        if (error instanceof Error) {
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);
            // If it's a wallet signing error, try once more after a delay
            if (error.name === 'WalletSignMessageError') {
                console.log("Retrying worker signin after wallet error...");
                await new Promise(resolve => setTimeout(resolve, 500));
                try {
                    const message = new TextEncoder().encode("Sign into DojoPay as a worker");
                    const signature = await signMessage?.(message);
                    if (signature) {
                        const response = await axios.post(`${BACKEND_URL}/v1/worker/signin`, {
                            signature,
                            publicKey: publicKey?.toString()
                        });
                        localStorage.setItem("workerToken", response.data.token);
                        return true;
                    }
                } catch (retryError) {
                    console.error("Retry also failed:", retryError);
                }
            }
        }
        return false;
    } finally {
        setSigningIn(false);
    }
}

  useEffect(() => {
    if (mounted && publicKey) {
      // Only auto-sign if user type is already selected
      const hasCreatorToken = localStorage.getItem("token");
      const hasWorkerToken = localStorage.getItem("workerToken");

      if (hasCreatorToken || hasWorkerToken) {
        // User already signed in, just set the user type
        if (hasCreatorToken) {
          onUserTypeSelect("creator");
        } else {
          onUserTypeSelect("worker");
        }
      } else {
        // Show user type selection modal
        setShowUserTypeModal(true);
      }
    }
  }, [publicKey, mounted]);

  useEffect(() => {
    if (mounted && !publicKey) {
      const wasConnected = prevConnectedRef.current;
      prevConnectedRef.current = false;

      // Clear tokens when wallet disconnects
      localStorage.removeItem("token");
      localStorage.removeItem("workerToken");

      // Redirect only on an actual disconnect (connected -> disconnected)
      if (wasConnected) {
        window.location.href = "/";
      }
    }
  }, [publicKey, mounted]);

  useEffect(() => {
    if (!mounted) return;
    prevConnectedRef.current = !!publicKey;
  }, [publicKey, mounted]);

  // Fetch worker earnings
  const fetchWorkerEarnings = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/v1/worker/balance`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("workerToken")}`
        }
      });
      setWorkerEarnings(response.data);
    } catch (error) {
      console.error("Failed to fetch worker earnings:", error);
    }
  };

  // Withdraw earnings
  const withdrawEarnings = async () => {
    if (!workerEarnings?.pendingAmount || parseFloat(workerEarnings.pendingAmount) <= 0) {
      showToast("No earnings available to withdraw", "error");
      return;
    }

    if (!signMessage) {
      showToast("Wallet signing not available", "error");
      return;
    }

    setWithdrawing(true);
    try {
      // Create withdrawal confirmation message
      const lamportsToWithdraw = workerEarnings.pendingAmount;
      const withdrawalMessage = new TextEncoder().encode(`Withdraw ${lamportsToWithdraw} lamports to ${publicKey?.toString()}`);
      
      // Request user signature for withdrawal confirmation
      const withdrawalSignature = await signMessage(withdrawalMessage);
      
      if (!withdrawalSignature) {
        showToast("Withdrawal signature required", "error");
        return;
      }

      const response = await axios.post(`${BACKEND_URL}/v1/worker/payout`, {
        signature: withdrawalSignature,
      }, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("workerToken")}`
        }
      });
      
      // Refresh earnings after successful withdrawal
      await fetchWorkerEarnings();
      
      if (response.data.signature) {
        showToast(`Successfully withdrew ${lamportsToSol(workerEarnings.pendingAmount)} SOL! Transaction: ${response.data.signature.slice(0, 8)}...`, "success");
      } else {
        showToast("Withdrawal successful!", "success");
      }
    } catch (error: any) {
      console.error("Withdrawal failed:", error);
      const errorMessage = error.response?.data?.message || "Withdrawal failed. Please try again.";
      showToast(errorMessage, "error");
    } finally {
      setWithdrawing(false);
    }
  };

  // Fetch earnings when user is worker
  useEffect(() => {
    if (userType === 'worker' && mounted) {
      fetchWorkerEarnings();
      // Refresh earnings every 30 seconds
      const interval = setInterval(fetchWorkerEarnings, 30000);
      return () => clearInterval(interval);
    }
  }, [userType, mounted]);

  if (!mounted) {
    return (
      <div className="flex justify-between items-center border-b pb-2 pt-2 fixed top-0 left-0 right-0 bg-white z-50 w-screen">
        <div className="flex items-center flex-1 min-w-0">
          <div className="text-base sm:text-lg lg:text-xl xl:text-2xl pl-2 sm:pl-4 flex-1 font-bold tracking-tight text-gray-900 truncate">
            DojoPay
          </div>
        </div>
        <div className="flex items-center pr-2 sm:pr-4">
          <div className="w-16 sm:w-20 h-10 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center border-b pb-2 pt-2 fixed top-0 left-0 right-0 bg-white z-50 w-screen">
        <div className="flex items-center flex-1 min-w-0">
          {/* Hamburger menu for mobile */}
          {userType && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex-shrink-0"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="text-base sm:text-lg lg:text-xl xl:text-2xl pl-2 sm:pl-4 flex-1 font-bold tracking-tight text-gray-900 truncate">
            DojoPay
          </div>
        </div>
        <div className="flex items-center pr-2 sm:pr-4 gap-2 sm:gap-3">
          {/* Worker earnings display */}
          {userType === 'worker' && workerEarnings && (
            <div className="flex items-center gap-2 bg-green-50 px-2 py-1 rounded-lg border border-green-200">
              <div className="text-xs sm:text-sm">
                <div className="font-semibold text-green-800">
                  {lamportsToSol(workerEarnings.pendingAmount)} SOL
                </div>
                <div className="text-xs text-green-600">
                  Available
                </div>
              </div>
              {parseFloat(workerEarnings.pendingAmount) > 0 && (
                <button
                  onClick={withdrawEarnings}
                  disabled={withdrawing}
                  className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {withdrawing ? "Withdrawing..." : "Withdraw"}
                </button>
              )}
            </div>
          )}
          
          {/* Wallet button */}
          {publicKey ? <WalletDisconnectButton /> : <WalletMultiButton />}
        </div>
      {/* <UserTypeModal 
            isOpen={showUserTypeModal}
            onClose={() => setShowUserTypeModal(false)}
            onSelectType={(type) => {
                onUserTypeSelect(type);
                setShowUserTypeModal(false);
            }}
            onCreatorSignIn={signAndSend}
            onWorkerSignIn={signAndSendWorker}
            signingIn={signingIn}
        /> */}
      </div>
      
      {/* Mobile Menu */}
      <MobileMenu 
        isOpen={mobileMenuOpen} 
        onClose={() => setMobileMenuOpen(false)} 
        userType={userType}
      />
      
      {/* UserTypeModal */}
      <UserTypeModal
        isOpen={showUserTypeModal}
        onClose={() => {
          if (!signingIn) {
            setShowUserTypeModal(false);
          }
        }}
        onSelectType={() => {}} // No-op since we handle this after sign-in
        onCreatorSignIn={async () => {
          const success = await signAndSend();
          if (success) {
            setUserType("creator");
            setShowUserTypeModal(false);
          }
        }}
        onWorkerSignIn={async () => {
          const success = await signAndSendWorker();
          if (success) {
            setUserType("worker");
            setShowUserTypeModal(false);
          }
        }}
        signingIn={signingIn}
      />
    </>
  );
};
