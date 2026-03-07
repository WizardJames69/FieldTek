import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { PricingSection } from "@/components/landing/PricingSection";
import { WaitlistModal } from "@/components/landing/WaitlistModal";


export default function Pricing() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#09090B]">
      <Helmet>
        <title>Pricing | FieldTek</title>
        <meta name="description" content="Transparent pricing that scales with your team. Plans for field service contractors across every trade." />
        <link rel="canonical" href="https://fieldtek.ai/pricing" />
        <meta property="og:title" content="Pricing | FieldTek" />
        <meta property="og:description" content="Transparent pricing that scales with your team. Plans for field service contractors across every trade." />
        <meta property="og:url" content="https://fieldtek.ai/pricing" />
        <meta property="og:image" content="https://fieldtek.ai/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://fieldtek.ai/og-image.png" />
      </Helmet>
      <Navbar />
      <main className="pt-16">
        <PricingSection onJoinWaitlist={() => setWaitlistOpen(true)} />
      </main>
      <Footer />
      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </div>
  );
}
