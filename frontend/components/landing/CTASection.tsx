export const CTASection = () => {
  return (
    <section className="py-32 bg-gray-900 text-white text-center">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-5xl font-bold tracking-tight mb-6">Start Building with DojoPay</h2>
        <p className="text-xl opacity-90 mb-10 max-w-2xl mx-auto">
          Join creators and workers using the fastest, most transparent task platform in Web3.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#"
            className="bg-white text-gray-900 px-8 py-4 rounded-xl font-semibold hover:-translate-y-1 hover:shadow-2xl transition-all"
          >
            Create Your First Task
          </a>
          <a
            href="#"
            className="bg-transparent text-white px-8 py-4 rounded-xl font-semibold border-2 border-white/30 hover:border-white hover:bg-white/5 hover:-translate-y-1 transition-all"
          >
            Earn by Completing Tasks
          </a>
        </div>
      </div>
    </section>
  );
};
