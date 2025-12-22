"use client";
import type { MouseEvent } from "react";
type NavbarProps = {
  onGetStarted?: () => void;
};

export const Navbar = ({ onGetStarted }: NavbarProps) => {
  const handleGetStarted = (e: MouseEvent<HTMLAnchorElement>) => {
    if (onGetStarted) {
      e.preventDefault();
      onGetStarted();
    }
  };

  return (
    <>
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold tracking-tight">DojoPay</div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 font-medium text-[15px] transition-colors">
                How It Works
              </a>
              <a href="#for-creators" className="text-gray-600 hover:text-gray-900 font-medium text-[15px] transition-colors">
                For Creators
              </a>
              <a href="#for-workers" className="text-gray-600 hover:text-gray-900 font-medium text-[15px] transition-colors">
                For Workers
              </a>
              <a href="#" className="bg-gray-900 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:shadow-md hover:bg-gray-800 transition-all" onClick={handleGetStarted}>
                Get Started
              </a>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};
