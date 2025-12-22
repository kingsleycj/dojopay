"use client";
import { Button } from "@/components/ui/button";
type HeroSectionProps = {
  onGetStarted?: () => void;
  onJoinAsWorker?: () => void;
};

export const HeroSection = ({ onGetStarted, onJoinAsWorker }: HeroSectionProps) => {
  const handleGetStarted = () => {
    onGetStarted?.();
  };

  const handleJoinAsWorker = () => {
    onJoinAsWorker?.();
  };

  return (
    <>
      <section className="py-32 bg-white relative overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-50" />
        
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center">
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-tight mb-6 text-gray-900">
              Turn Tasks Into<br />
              Instant{" "}
              <span className="relative inline-block text-[#f97316]">
                Rewards
                <svg
                  className="absolute left-0 -bottom-2 w-full h-4 opacity-80"
                  viewBox="0 0 200 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 14C35 4 70 18 100 12C130 6 160 10 194 8"
                    stroke="#f97316"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-12 leading-relaxed">
              A Solana-powered platform for human tasks, data labeling, and micro-work built for speed, transparency, and scale.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button 
                size="lg"
                className="bg-gray-900 text-white px-8 py-4 rounded-xl font-semibold shadow-md hover:shadow-lg hover:bg-gray-800 transition-all hover:-translate-y-0.5"
                onClick={handleGetStarted}
              >
                Get Started
              </Button>
              <Button 
                variant="outline"
                size="lg"
                className="bg-white text-gray-900 px-8 py-4 rounded-xl font-semibold border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all hover:-translate-y-0.5"
                onClick={handleJoinAsWorker}
              >
                Join as a Worker
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:shadow transition-all">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-[#f97316]/10 blur-sm animate-pulse" />
                  <svg className="relative h-4 w-4" viewBox="0 0 397.7 311.7" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="solHero1" x1="360.879" y1="351.455" x2="141.213" y2="-69.2936" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#14F195"/>
                        <stop offset="1" stopColor="#9945FF"/>
                      </linearGradient>
                      <linearGradient id="solHero2" x1="264.829" y1="401.601" x2="45.163" y2="-19.1475" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#14F195"/>
                        <stop offset="1" stopColor="#9945FF"/>
                      </linearGradient>
                      <linearGradient id="solHero3" x1="312.548" y1="376.688" x2="92.8822" y2="-44.061" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#14F195"/>
                        <stop offset="1" stopColor="#9945FF"/>
                      </linearGradient>
                    </defs>
                    <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="url(#solHero1)"/>
                    <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="url(#solHero2)"/>
                    <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="url(#solHero3)"/>
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700">Powered by Solana</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="hidden sm:block w-1 h-1 bg-gray-300 rounded-full"></div>
              <span className="text-sm text-gray-500">Initiated from SuperteamNG Builders Cohort</span>
            </div>

            {/* Hero Visual */}
            <div className="mt-20 px-4 sm:px-10">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 sm:p-10 shadow-xl">
                <div className="bg-white rounded-xl border border-gray-200 p-8">
                  <div className="flex justify-between items-center pb-4 border-b border-gray-200 mb-6">
                    <div className="text-lg font-semibold text-gray-900">Active Tasks</div>
                    <div className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">
                      Live
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                      <div className="text-sm font-semibold mb-2 text-gray-900">Tasks Completed</div>
                      <div className="text-3xl font-bold text-gray-900">12,847</div>
                    </div>
                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                      <div className="text-sm font-semibold mb-2 text-gray-900">Active Workers</div>
                      <div className="text-3xl font-bold text-gray-900">1,523</div>
                    </div>
                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                      <div className="text-sm font-semibold mb-2 text-gray-900">SOL Distributed</div>
                      <div className="text-3xl font-bold text-gray-900">8,450</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
