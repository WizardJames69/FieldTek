import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getPostLoginDestination } from "@/lib/authRouting";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrustBar } from "@/components/landing/TrustBar";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { Footer } from "@/components/landing/Footer";
import { CookieConsent } from "@/components/landing/CookieConsent";
import { WaitlistModal } from "@/components/landing/WaitlistModal";
import { Skeleton } from "@/components/ui/skeleton";
import { initAnalytics } from "@/lib/analytics";

// Lazy load below-the-fold sections
const AIIntelligenceSection = lazy(() =>
  import("@/components/landing/AIIntelligenceSection").then((m) => ({ default: m.AIIntelligenceSection }))
);
const FeatureShowcase = lazy(() =>
  import("@/components/landing/FeatureShowcase").then((m) => ({ default: m.FeatureShowcase }))
);
const SocialProofSection = lazy(() =>
  import("@/components/landing/SocialProofSection").then((m) => ({ default: m.SocialProofSection }))
);
const HowItWorksSection = lazy(() =>
  import("@/components/landing/HowItWorksSection").then((m) => ({ default: m.HowItWorksSection }))
);
const ClientPortalSection = lazy(() =>
  import("@/components/landing/ClientPortalSection").then((m) => ({ default: m.ClientPortalSection }))
);
const FAQSection = lazy(() =>
  import("@/components/landing/FAQSection").then((m) => ({ default: m.FAQSection }))
);
const CTASection = lazy(() =>
  import("@/components/landing/CTASection").then((m) => ({ default: m.CTASection }))
);

function SectionSkeleton({ minHeight = "min-h-[400px]" }: { minHeight?: string }) {
  return (
    <div className={`py-24 px-4 ${minHeight}`}>
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-6 w-96 mx-auto" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  useEffect(() => {
    initAnalytics();
    if (searchParams.get("waitlist") === "open") {
      setWaitlistOpen(true);
      searchParams.delete("waitlist");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const tryScroll = () => {
        const el = document.getElementById(hash);
        if (el) {
          const offset = el.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: offset, behavior: "smooth" });
        }
      };
      setTimeout(tryScroll, 300);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (user && !isRedirecting) {
      setIsRedirecting(true);
      getPostLoginDestination().then(({ destination }) => {
        navigate(destination, { replace: true });
      });
    }
  }, [user, authLoading, navigate, isRedirecting]);

  const openWaitlist = () => setWaitlistOpen(true);

  return (
    <div className="min-h-screen overflow-x-hidden noise-overlay">
      {/* Dark hero zone */}
      <div className="landing-section-dark">
        <Navbar />
        <HeroSection />
      </div>

      <main>
        {/* Content sections (all dark) */}
        <TrustBar />
        <ProblemSection />
        <FeaturesSection />

        {/* AI Intelligence section */}
        <Suspense fallback={<SectionSkeleton minHeight="min-h-[500px]" />}>
          <AIIntelligenceSection />
        </Suspense>

        {/* Feature deep-dives */}
        <Suspense fallback={<SectionSkeleton minHeight="min-h-[600px]" />}>
          <FeatureShowcase />
          <ClientPortalSection />
          <HowItWorksSection />
          <SocialProofSection />
          <FAQSection />
        </Suspense>

        {/* CTA */}
        <Suspense fallback={<SectionSkeleton minHeight="min-h-[300px]" />}>
          <CTASection onJoinWaitlist={openWaitlist} />
        </Suspense>
      </main>

      <Footer />
      <CookieConsent />
      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </div>
  );
}
