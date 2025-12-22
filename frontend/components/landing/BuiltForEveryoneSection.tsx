import { BriefcaseBusiness, Rocket, Wrench } from "lucide-react";

const cards = [
  {
    id: "for-creators",
    Icon: Rocket,
    title: "Creators",
    description:
      "AI teams, startups, and businesses who need scalable human input for data labeling, validation, and feedback.",
    items: [
      "Post unlimited tasks",
      "Access global workforce",
      "Real-time progress tracking",
      "Quality control tools",
    ],
  },
  {
    id: "for-workers",
    Icon: BriefcaseBusiness,
    title: "Workers",
    description:
      "Global contributors who want to earn on their own schedule by completing meaningful micro-tasks and bounties.",
    items: [
      "Instant SOL payments",
      "Flexible work hours",
      "Build your reputation",
      "Fair, transparent rates",
    ],
  },
  {
    id: "",
    Icon: Wrench,
    title: "Builders & Investors",
    description:
      "Web3 builders and investors looking for proven solutions in the task economy and AI training data space.",
    items: [
      "Proven traction",
      "SuperteamNG backed",
      "Scalable infrastructure",
      "Growing ecosystem",
    ],
  },
];

export const BuiltForEveryoneSection = () => {
  return (
    <section id="for-everyone" className="py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <div className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
            Built For Everyone
          </div>
          <h2 className="text-5xl font-bold tracking-tight mb-4 text-gray-900">
            Designed for the Task Economy
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Whether you're building AI models, managing teams, or earning on your own terms—DojoPay scales with you.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {cards.map((card) => (
            <div
              key={card.title}
              id={card.id || undefined}
              className="bg-white border border-gray-200 rounded-xl p-10 hover:border-gray-900/20 hover:-translate-y-1 hover:shadow-xl transition-all"
            >
              {/* Background glow */}
              <div className="w-12 h-12 bg-[#fff7ed] rounded-xl flex items-center justify-center mb-6 border border-[#fed7aa]">
                <card.Icon className="h-6 w-6 text-gray-900" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-gray-900">{card.title}</h3>
              <p className="text-gray-600 mb-5 leading-relaxed">{card.description}</p>
              <ul className="space-y-2 text-sm text-gray-600">
                {card.items.map((item) => (
                  <li key={item} className="flex items-start">
                    <span className="text-[#f97316] mr-2">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto mt-16">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">150+</div>
            <div className="text-gray-600">Countries Supported</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">0.001 SOL</div>
            <div className="text-gray-600">Minimum Reward</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">&lt;1s</div>
            <div className="text-gray-600">Payout Time</div>
          </div>
        </div>
      </div>
    </section>
  );
};
