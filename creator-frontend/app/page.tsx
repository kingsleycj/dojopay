"use client";
import { Appbar } from "@/components/Appbar";
import { Hero } from "@/components/Hero";
import { Upload } from "@/components/Upload";
import { ToastContainer } from "@/components/Toast";

export default function Home() {
  return (
    <div>
      <ToastContainer />
      <Appbar />
      <div className="flex justify-center pt-8">
        <div className="max-w-screen-lg">
          <Hero />
          <Upload />
        </div>
      </div>
      <footer className="mt-16 py-8 border-t border-gray-200">
        <div className="flex justify-center items-center gap-2 text-gray-600">
          <span className="text-sm">Powered by</span>
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="45" fill="url(#gradient)"/>
              <path d="M50 15L65 35H55V65H45V35H35L50 15Z" fill="white"/>
              <path d="M50 85L35 65H45V35H55V65H65L50 85Z" fill="white" opacity="0.8"/>
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9945FF"/>
                  <stop offset="100%" stopColor="#14F195"/>
                </linearGradient>
              </defs>
            </svg>
            <span className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-teal-400 bg-clip-text text-transparent">Solana</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
