"use client";
import { BriefcaseBusiness, Sparkles } from "lucide-react";

interface UserTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'creator' | 'worker') => void;
  onCreatorSignIn: () => void;
  onWorkerSignIn: () => void;
  signingIn: boolean;
}

export const UserTypeModal = ({ isOpen, onClose, onSelectType, onCreatorSignIn, onWorkerSignIn, signingIn }: UserTypeModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="text-center mb-5">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to DojoPay</h2>
          <p className="text-gray-600 text-sm">
            Choose your role. Then we’ll connect your wallet and request a signature.
          </p>
        </div>
        
        {signingIn ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f97316]"></div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => {
                onCreatorSignIn();
                onSelectType('creator');
              }}
              className="w-full p-4 rounded-xl border border-gray-200 hover:border-gray-900/20 hover:bg-gray-50 transition-all hover:-translate-y-0.5 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-10 w-10 rounded-xl bg-[#fff7ed] border border-[#fed7aa] flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-gray-900" />
                </div>
                <div className="flex-1">
                  <div className="text-base font-semibold text-gray-900">Creator</div>
                  <div className="text-sm text-gray-600 mt-1">
                Create tasks and pay workers to complete them
                  </div>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => {
                onWorkerSignIn();
                onSelectType('worker');
              }}
              className="w-full p-4 rounded-xl border border-gray-200 hover:border-gray-900/20 hover:bg-gray-50 transition-all hover:-translate-y-0.5 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-10 w-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
                  <BriefcaseBusiness className="h-5 w-5 text-gray-900" />
                </div>
                <div className="flex-1">
                  <div className="text-base font-semibold text-gray-900">Worker</div>
                  <div className="text-sm text-gray-600 mt-1">
                Complete tasks and earn SOL rewards
                  </div>
                </div>
              </div>
            </button>
          </div>
        )}
        
        <button
          onClick={onClose}
          className="mt-5 w-full text-gray-500 hover:text-gray-700 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
