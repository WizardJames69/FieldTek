import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { getPostLoginDestination } from "@/lib/authRouting";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrustBar } from "@/components/landing/TrustBar";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { Footer } from "@/components/landing/Footer";

import { WaitlistModal } from "@/components/landing/WaitlistModal";
import { BetaTesterModal } from "@/components/landing/BetaTesterModal";
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
const IntelligenceLoopSection = lazy(() =>
  import("@/components/landing/IntelligenceLoopSection").then((m) => ({ default: m.IntelligenceLoopSection }))
);
const SentinelReasoningSection = lazy(() =>
  import("@/components/landing/SentinelReasoningSection").then((m) => ({ default: m.SentinelReasoningSection }))
);
const EvidenceSection = lazy(() =>
  import("@/components/landing/EvidenceSection").then((m) => ({ default: m.EvidenceSection }))
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
  const [betaModalOpen, setBetaModalOpen] = useState(false);

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

  // Keep the canvas behind the page dark while the landing is mounted so iOS
  // rubber-band overscroll doesn't flash white around the dark sections. The
  // global --background stays light for the app (see index.css).
  useEffect(() => {
    document.documentElement.classList.add('landing-html-bg');
    return () => document.documentElement.classList.remove('landing-html-bg');
  }, []);

  const openWaitlist = () => setWaitlistOpen(true);
  const openBetaModal = () => setBetaModalOpen(true);

  return (
    <div className="landing-page min-h-screen overflow-x-hidden noise-overlay">
      <Helmet>
        <title>FieldTek | AI-Powered Field Service Platform | Guide Every Repair. Learn From Every Job.</title>
        <meta name="description" content="FieldTek's Sentinel AI answers technician questions from your uploaded manuals — with page-level citations. Job records, scheduling, invoicing, and a customer portal built in. For HVAC, electrical, plumbing, and mechanical contractors." />
        <meta name="keywords" content="field service management, HVAC software, AI field service, install documentation, Sentinel AI, technician guidance, HVAC technician app, plumbing software, electrical contractor software, mechanical contractor software, field service app, AI assistant for technicians, NEC code reference" />
        <link rel="canonical" href="https://fieldtek.ai/" />
        <meta property="og:title" content="FieldTek | Guide Every Repair. Learn From Every Job." />
        <meta property="og:description" content="AI-powered field service software. Sentinel AI answers technician questions from your uploaded manuals — with citations. Scheduling, job records, invoicing, and a customer portal built in." />
        <meta property="og:url" content="https://fieldtek.ai/" />
        <meta property="og:image" content="https://fieldtek.ai/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="FieldTek | Guide Every Repair. Learn From Every Job." />
        <meta name="twitter:description" content="AI-powered field service software. Sentinel AI answers technician questions from your uploaded manuals — with citations." />
        <meta name="twitter:image" content="https://fieldtek.ai/og-image.png" />
      </Helmet>

      {/* Dark hero zone */}
      <div className="landing-section-dark">
        <Navbar onApply={openBetaModal} />
        <HeroSection onApply={openBetaModal} />
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

        {/* Intelligence loop + Sentinel reasoning */}
        <Suspense fallback={<SectionSkeleton minHeight="min-h-[500px]" />}>
          <IntelligenceLoopSection />
          <SentinelReasoningSection />
        </Suspense>

        {/* Feature deep-dives */}
        <Suspense fallback={<SectionSkeleton minHeight="min-h-[600px]" />}>
          <FeatureShowcase />
          <EvidenceSection />
          <ClientPortalSection />
          <HowItWorksSection />
          <SocialProofSection onApply={openBetaModal} />
        </Suspense>

      </main>

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <Footer />
      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
      <BetaTesterModal open={betaModalOpen} onOpenChange={setBetaModalOpen} />
    </div>
  );
}
