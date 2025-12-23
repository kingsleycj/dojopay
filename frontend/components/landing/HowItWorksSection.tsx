export const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-32 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <div className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
            How DojoPay Works
          </div>
          <h2 className="text-5xl font-bold tracking-tight mb-4 text-gray-900">Simple. Fast. Transparent.</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Three steps to connect task creators with global workers—powered by Solana's speed and reliability.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-12">
          <div className="text-center">
            <div className="w-14 h-14 bg-gray-900 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 ring-4 ring-[#fff7ed]">
              1
            </div>
            <h3 className="text-2xl font-semibold mb-3 text-gray-900">Create Tasks</h3>
            <p className="text-gray-600 leading-relaxed">
              Post data labeling jobs, micro-tasks, or bounties. Set your budget, define requirements, and launch in minutes.
            </p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 bg-gray-900 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 ring-4 ring-[#fff7ed]">
              2
            </div>
            <h3 className="text-2xl font-semibold mb-3 text-gray-900">Complete Tasks</h3>
            <p className="text-gray-600 leading-relaxed">
              Workers browse available tasks, complete high-quality work, and submit for verification in a streamlined workflow.
            </p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 bg-gray-900 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 ring-4 ring-[#fff7ed]">
              3
            </div>
            <h3 className="text-2xl font-semibold mb-3 text-gray-900">Earn Instantly in SOL</h3>
            <p className="text-gray-600 leading-relaxed">
              Upon approval, workers receive instant payment in SOL. No delays, no intermediaries, no hidden fees.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
