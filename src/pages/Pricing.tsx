import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { PricingSection } from "@/components/landing/PricingSection";
import { WaitlistModal } from "@/components/landing/WaitlistModal";
import { CookieConsent } from "@/components/landing/CookieConsent";

export default function Pricing() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Pricing — FieldTek AI | Plans for Every Team Size</title>
        <meta name="description" content="Transparent pricing for FieldTek AI field service management. Choose the plan that fits your team — from solo technicians to enterprise operations." />
        <link rel="canonical" href="https://fieldtek.ai/pricing" />
        <meta property="og:title" content="Pricing — FieldTek AI" />
        <meta property="og:description" content="Transparent pricing for FieldTek AI field service management. Choose the plan that fits your team." />
        <meta property="og:url" content="https://fieldtek.ai/pricing" />
      </Helmet>
      <Navbar />
      <main className="pt-16">
        <PricingSection onJoinWaitlist={() => setWaitlistOpen(true)} />
      </main>
      <Footer />
      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
      <CookieConsent />
    </div>
  );
}
