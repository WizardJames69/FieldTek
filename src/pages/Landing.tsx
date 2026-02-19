import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getPostLoginDestination } from "@/lib/authRouting";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { Footer } from "@/components/landing/Footer";
import { BackToTop } from "@/components/landing/BackToTop";
import { CookieConsent } from "@/components/landing/CookieConsent";
import { Skeleton } from "@/components/ui/skeleton";
import { LaunchBanner } from "@/components/landing/LaunchBanner";
import { WaitlistModal } from "@/components/landing/WaitlistModal";
import { BetaTesterModal } from "@/components/landing/BetaTesterModal";
import { SocialShare } from "@/components/landing/SocialShare";
import { ExitIntentPopup } from "@/components/landing/ExitIntentPopup";
import { initAnalytics } from "@/lib/analytics";
import { GlowDivider } from "@/components/landing/GlowDivider";
import { BetaFAB } from "@/components/landing/BetaFAB";

// Lazy load heavy below-the-fold components
const IntegratedDemoSection = lazy(() => import("@/components/landing/IntegratedDemoSection").then(m => ({ default: m.IntegratedDemoSection })));
const AIAssistantDemo = lazy(() => import("@/components/landing/AIAssistantDemo").then(m => ({ default: m.AIAssistantDemo })));
const RoleInterfaceShowcase = lazy(() => import("@/components/landing/RoleInterfaceShowcase").then(m => ({ default: m.RoleInterfaceShowcase })));
const ROICalculator = lazy(() => import("@/components/landing/ROICalculator").then(m => ({ default: m.ROICalculator })));
const PricingSection = lazy(() => import("@/components/landing/PricingSection").then(m => ({ default: m.PricingSection })));
const BetaTesterSection = lazy(() => import("@/components/landing/BetaTesterSection").then(m => ({ default: m.BetaTesterSection })));
const FAQSection = lazy(() => import("@/components/landing/FAQSection").then(m => ({ default: m.FAQSection })));
const CTASection = lazy(() => import("@/components/landing/CTASection").then(m => ({ default: m.CTASection })));

// Lightweight fallback for lazy-loaded sections
function SectionSkeleton({ minHeight = "min-h-[400px]" }: { minHeight?: string }) {
  return (
    <div className={`py-24 px-4 ${minHeight} animate-fade-in`}>
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
  const [betaTesterOpen, setBetaTesterOpen] = useState(false);

  // Initialize analytics and check for waitlist param
  useEffect(() => {
    initAnalytics();
    
    if (searchParams.get('waitlist') === 'open') {
      setWaitlistOpen(true);
      // Remove the query param to clean up URL
      searchParams.delete('waitlist');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Redirect authenticated users to appropriate destination
  useEffect(() => {
    if (authLoading) return;
    
    if (user && !isRedirecting) {
      setIsRedirecting(true);
      // Use centralized routing to determine destination
      getPostLoginDestination().then(({ destination }) => {
        navigate(destination, { replace: true });
      });
    }
  }, [user, authLoading, navigate, isRedirecting]);

  const openWaitlist = () => setWaitlistOpen(true);
  const openBetaTester = () => setBetaTesterOpen(true);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <LaunchBanner onJoinWaitlist={openWaitlist} />
      <Navbar />
      <main>
        {/* Above-the-fold: loaded immediately */}
        <HeroSection onJoinWaitlist={openWaitlist} onApplyBeta={openBetaTester} />
        
        {/* Glow divider */}
        <GlowDivider color="primary" />
        
        {/* Comparison section - key for differentiation */}
        <ComparisonSection />
        
        {/* Glow divider */}
        <GlowDivider color="primary" />
        
        {/* Group 1: Demo zone */}
        <Suspense fallback={<SectionSkeleton minHeight="min-h-[600px]" />}>
          <div>
            <IntegratedDemoSection />
            <AIAssistantDemo />
          </div>
        </Suspense>
        
        {/* Core Capabilities - eagerly loaded */}
        <FeaturesSection />
        
        {/* Group 2: Showcase zone */}
        <GlowDivider color="accent" />
        <Suspense fallback={<SectionSkeleton minHeight="min-h-[500px]" />}>
          <div>
            <RoleInterfaceShowcase />
            <ROICalculator />
            <PricingSection onJoinWaitlist={openWaitlist} />
          </div>
        </Suspense>
        
        {/* Group 3: Bottom zone */}
        <GlowDivider color="muted" />
        <Suspense fallback={<SectionSkeleton minHeight="min-h-[400px]" />}>
          <div>
            <div id="beta-program">
              <BetaTesterSection onApply={openBetaTester} />
            </div>
            <GlowDivider color="primary" />
            <FAQSection />
            <CTASection onJoinWaitlist={openWaitlist} />
          </div>
        </Suspense>
      </main>
      <Footer />
      <BackToTop />
      <SocialShare variant="floating" />
      <BetaFAB onApply={openBetaTester} />
      <CookieConsent />
      <ExitIntentPopup onJoinWaitlist={openWaitlist} />
      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
      <BetaTesterModal open={betaTesterOpen} onOpenChange={setBetaTesterOpen} />
    </div>
  );
}
