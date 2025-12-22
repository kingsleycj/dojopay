import superteamLogo from "@/assets/superteam-logo.png";

export const CredibilitySection = () => {
  return (
    <section className="py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Credibility & Trust</div>
          <h2 className="text-5xl font-bold tracking-tight mb-4 text-gray-900">Powered by the Best</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            DojoPay is built on Solana and initiated through the SuperteamNG Builders Cohort.
          </p>
        </div>

        <div className="mt-14 grid md:grid-cols-2 gap-10 items-center">
          {/* Solana */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-full bg-[#f97316]/10 blur-2xl animate-pulse" />
              <div className="absolute -inset-2 rounded-full bg-[#f97316]/10 blur-3xl" />
              <svg className="relative h-16 w-16" viewBox="0 0 397.7 311.7" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="solCred1" x1="360.879" y1="351.455" x2="141.213" y2="-69.2936" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#14F195"/>
                    <stop offset="1" stopColor="#9945FF"/>
                  </linearGradient>
                  <linearGradient id="solCred2" x1="264.829" y1="401.601" x2="45.163" y2="-19.1475" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#14F195"/>
                    <stop offset="1" stopColor="#9945FF"/>
                  </linearGradient>
                  <linearGradient id="solCred3" x1="312.548" y1="376.688" x2="92.8822" y2="-44.061" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#14F195"/>
                    <stop offset="1" stopColor="#9945FF"/>
                  </linearGradient>
                </defs>
                <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="url(#solCred1)"/>
                <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="url(#solCred2)"/>
                <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="url(#solCred3)"/>
              </svg>
            </div>
            <div className="text-gray-900 font-semibold">Powered by Solana</div>
            <div className="mt-1 text-gray-500 text-sm">Fast. Low fees. Scales for micro-payments.</div>
          </div>

          {/* SuperteamNG */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-full bg-gray-900/10 blur-2xl" />
              <img src={superteamLogo.src} alt="SuperteamNG" className="relative h-12 w-auto" />
            </div>
            <div className="text-gray-900 font-semibold">SuperteamNG Builders Cohort</div>
            <div className="mt-1 text-gray-500 text-sm">Community-driven, quality-first</div>
          </div>
        </div>
      </div>
    </section>
  );
};
