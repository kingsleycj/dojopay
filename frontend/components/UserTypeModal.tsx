"use client";
import { useState } from 'react';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-center mb-6">Welcome to DojoPay</h2>
        <p className="text-gray-600 text-center mb-8">
          Choose how you'd like to participate in the Solana task marketplace
        </p>
        
        {signingIn ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => {
                onCreatorSignIn();
                onSelectType('creator');
              }}
              className="w-full p-4 border-2 border-purple-500 rounded-lg hover:bg-purple-50 transition-colors"
            >
              <div className="text-lg font-semibold text-purple-600">Creator</div>
              <div className="text-sm text-gray-600 mt-1">
                Create tasks and pay workers to complete them
              </div>
            </button>
            
            <button
              onClick={() => {
                onWorkerSignIn();
                onSelectType('worker');
              }}
              className="w-full p-4 border-2 border-teal-500 rounded-lg hover:bg-teal-50 transition-colors"
            >
              <div className="text-lg font-semibold text-teal-600">Worker</div>
              <div className="text-sm text-gray-600 mt-1">
                Complete tasks and earn SOL rewards
              </div>
            </button>
          </div>
        )}
        
        <button
          onClick={onClose}
          className="mt-6 w-full text-gray-500 hover:text-gray-700 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
