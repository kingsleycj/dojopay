import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { BuiltForEveryoneSection } from "@/components/landing/BuiltForEveryoneSection";
import { WhySolanaSection } from "@/components/landing/WhySolanaSection";
import { CredibilitySection } from "@/components/landing/CredibilitySection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <BuiltForEveryoneSection />
        <WhySolanaSection />
        <CredibilitySection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
