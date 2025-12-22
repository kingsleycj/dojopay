import { Coins, LineChart, Zap } from "lucide-react";

export const WhySolanaSection = () => {
  return (
    <section id="why-solana" className="py-32 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <div className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
            Why Solana
          </div>
          <h2 className="text-5xl font-bold tracking-tight mb-4 text-gray-900">Built for Micro-Payments</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Solana's speed and low fees make it the perfect foundation for instant task-based payments at scale.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-10 rounded-xl border border-gray-200">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-6">
              <Zap className="h-6 w-6 text-[#f97316]" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-900">Instant Settlement</h3>
            <p className="text-gray-600 leading-relaxed">
              Workers receive payments in seconds, not days. No waiting for bank transfers or payment processing delays.
            </p>
          </div>
          <div className="bg-white p-10 rounded-xl border border-gray-200">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-6">
              <Coins className="h-6 w-6 text-gray-900" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-900">Low Fees</h3>
            <p className="text-gray-600 leading-relaxed">
              Transactions cost fractions of a cent, making micro-payments economically viable for even the smallest tasks.
            </p>
          </div>
          <div className="bg-white p-10 rounded-xl border border-gray-200">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-6">
              <LineChart className="h-6 w-6 text-gray-900" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-900">Scales for Micro-Payments</h3>
            <p className="text-gray-600 leading-relaxed">
              Handle thousands of concurrent transactions without congestion or skyrocketing fees as you grow.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
