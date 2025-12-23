"use client";

import superteamLogo from "@/assets/superteam-logo.png";

export const ApplicationFooter = () => {
  return (
    <footer className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-8 border-t border-slate-700/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* Left Section - Developer Credits */}
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 animate-pulse" />
              <span className="text-sm text-slate-300 font-medium">
                Crafted with precision by Kingsley Nweke
              </span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-slate-600" />
            <span className="text-xs text-slate-400">
              © 2025 DojoPay. All rights reserved.
            </span>
          </div>

          {/* Center Section - Technology Stack */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/20 to-green-500/20 blur-xl group-hover:blur-2xl transition-all duration-300" />
                <svg 
                  className="relative h-8 w-8 transition-transform duration-300 group-hover:scale-110" 
                  viewBox="0 0 397.7 311.7" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="solFooter1" x1="360.879" y1="351.455" x2="141.213" y2="-69.2936" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#14F195"/>
                      <stop offset="1" stopColor="#9945FF"/>
                    </linearGradient>
                    <linearGradient id="solFooter2" x1="264.829" y1="401.601" x2="45.163" y2="-19.1475" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#14F195"/>
                      <stop offset="1" stopColor="#9945FF"/>
                    </linearGradient>
                    <linearGradient id="solFooter3" x1="312.548" y1="376.688" x2="92.8822" y2="-44.061" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#14F195"/>
                      <stop offset="1" stopColor="#9945FF"/>
                    </linearGradient>
                  </defs>
                  <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="url(#solFooter1)"/>
                  <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="url(#solFooter2)"/>
                  <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="url(#solFooter3)"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">Built on Solana</span>
                <span className="text-xs text-slate-400">Lightning-fast micro-payments</span>
              </div>
            </div>
          </div>

          {/* Right Section - Community */}
          <div className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-slate-700/20 backdrop-blur-sm group-hover:bg-slate-600/30 transition-all duration-300" />
              <img 
                src={superteamLogo.src} 
                alt="SuperteamNG" 
                className="relative h-8 w-auto transition-transform duration-300 group-hover:scale-105" 
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white">SuperteamNG</span>
              <span className="text-xs text-slate-400">Builders Cohort</span>
            </div>
          </div>
        </div>

        {/* Bottom Divider */}
        <div className="mt-6 pt-6 border-t border-slate-700/50">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Decentralized task marketplace</span>
              <span className="text-slate-600">•</span>
              <span>Powered by Solana</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="hover:text-white transition-colors duration-200 cursor-pointer">Privacy</span>
              <span className="text-slate-600">•</span>
              <span className="hover:text-white transition-colors duration-200 cursor-pointer">Terms</span>
              <span className="text-slate-600">•</span>
              <span className="hover:text-white transition-colors duration-200 cursor-pointer">Contact</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
