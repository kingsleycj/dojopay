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
        const message = new TextEncoder().encode("Sign into DojoPay as a worker");
        const signature = await signMessage?.(message);
        const response = await axios.post(`${BACKEND_URL}/v1/worker/signin`, {
            signature,
            publicKey: publicKey?.toString()
        });
        localStorage.setItem("workerToken", response.data.token);
        return true;
    } catch (error) {
        console.error("Backend worker signin failed:", error);
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

  if (!mounted) {
    return (
      <div className="flex justify-between border-b pb-2 pt-2 fixed top-0 left-0 right-0 bg-white z-50">
        <div className="text-xl sm:text-2xl pl-2 sm:pl-4 flex justify-center pt-3">
          DojoPay
        </div>
        <div className="text-xl pr-2 sm:pr-4 pb-2">
          <div className="w-16 sm:w-20 h-10 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between border-b pb-2 pt-2 fixed top-0 left-0 right-0 bg-white z-50">
        <div className="flex items-center">
          {/* Hamburger menu for mobile */}
          {userType && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 mr-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="text-xl sm:text-2xl pl-2 sm:pl-4 flex justify-center pt-3 font-bold tracking-tight text-gray-900">
            DojoPay
          </div>
        </div>
        <div className="text-xl pr-2 sm:pr-4 pb-2">
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
