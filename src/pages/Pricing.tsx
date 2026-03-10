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
        <title>Pricing | FieldTek - Plans for Every Team Size</title>
        <meta name="description" content="Transparent pricing for HVAC, electrical, plumbing, and mechanical contractors. Plans starting at $99/mo with Sentinel AI diagnostics, compliance reporting, and job management." />
        <meta name="keywords" content="field service pricing, HVAC software pricing, contractor software cost, field service management plans, Sentinel AI pricing" />
        <link rel="canonical" href="https://fieldtek.ai/pricing" />
        <meta property="og:title" content="FieldTek Pricing - Plans Starting at $99/mo" />
        <meta property="og:description" content="Transparent pricing for field service contractors. Includes Sentinel AI, compliance documentation, and job management." />
        <meta property="og:url" content="https://fieldtek.ai/pricing" />
        <meta property="og:image" content="https://fieldtek.ai/og-pricing.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="FieldTek Pricing - Plans Starting at $99/mo" />
        <meta name="twitter:description" content="Transparent pricing for field service contractors. Includes Sentinel AI, compliance documentation, and job management." />
        <meta name="twitter:image" content="https://fieldtek.ai/og-pricing.png" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "FieldTek",
          "description": "AI-powered field service platform with Sentinel AI for compliance diagnostics and warranty protection.",
          "url": "https://fieldtek.ai/pricing",
          "brand": { "@type": "Brand", "name": "FieldTek" },
          "offers": {
            "@type": "AggregateOffer",
            "priceCurrency": "USD",
            "lowPrice": "99",
            "highPrice": "449",
            "offerCount": "4",
            "offers": [
              { "@type": "Offer", "name": "Starter", "price": "99", "priceCurrency": "USD", "description": "For small teams. 2 technicians included." },
              { "@type": "Offer", "name": "Growth", "price": "229", "priceCurrency": "USD", "description": "For growing teams. 5 technicians included." },
              { "@type": "Offer", "name": "Professional", "price": "449", "priceCurrency": "USD", "description": "For large teams. 10 technicians included, unlimited jobs." },
              { "@type": "Offer", "name": "Enterprise", "price": "0", "priceCurrency": "USD", "description": "Custom pricing for unlimited technicians." }
            ]
          }
        })}</script>
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
