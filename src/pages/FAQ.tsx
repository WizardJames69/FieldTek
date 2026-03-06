import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { ChevronDown } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";


const faqs = [
  {
    question: "How is FieldTek different from traditional field service software?",
    answer: "Most field service platforms are built around scheduling and invoicing. FieldTek starts there too, but adds an AI layer that traditional tools don't have. Your technicians get step-by-step guidance pulled from actual manufacturer documentation, every install is automatically verified against OEM specs, and compliance reports generate themselves. Setup takes hours, not months, and there are no consultants or lengthy implementations required."
  },
  {
    question: "Can I switch from my current FSM software?",
    answer: "Absolutely! We offer free data migration assistance. Export your customers, equipment, and job history as CSV files, and our import tools (or our team) will help you transfer everything. Most teams are fully migrated within a day, not months."
  },
  {
    question: "Is FieldTek powerful enough for a growing team?",
    answer: "Yes. FieldTek scales from 2 to 50+ technicians. You get enterprise features like custom workflows, multi-location support, API access, and advanced analytics, without the enterprise complexity or pricing."
  },
  {
    question: "How long does it take to get started?",
    answer: "You can be up and running in under 15 minutes. Our onboarding wizard guides you through setting up your company profile, adding team members, and configuring your first job types. No consultants required, no training sessions, no technical expertise needed."
  },
  {
    question: "Does the AI learn from our service history?",
    answer: "Yes! FieldTek's AI doesn't just reference manuals, it analyzes your complete service history. When a technician opens a job, the AI automatically surfaces previous visits and what was done, recurring issue patterns, parts commonly needed for similar repairs, and proactive warranty expiration alerts. This context-aware intelligence helps techs diagnose faster and come prepared with the right parts."
  },
  {
    question: "How does the AI assistant work?",
    answer: "FieldTek's AI is document-grounded and history-aware. It references your uploaded service manuals for brand-specific answers, detects recurring issue patterns across your service history, predicts likely parts based on similar past repairs, and proactively warns about expiring warranties. Plus, incoming service requests are automatically analyzed by AI to suggest priority levels and job types."
  },
  {
    question: "Do my customers get their own portal?",
    answer: "Yes! Each customer gets access to a branded portal where they can submit service requests, view job status and history, see their equipment records, and pay invoices online. It reduces phone calls and gives your customers 24/7 visibility into their service relationship."
  },
  {
    question: "Does it work offline in the field?",
    answer: "Our mobile app is designed for field technicians with limited connectivity. Key features like viewing job details, updating status, and capturing photos work offline and sync automatically when you're back online."
  },
  {
    question: "What's included in the pricing?",
    answer: "No setup fees, no annual contracts, no hidden costs. Plans start at $99/month for small teams and scale to $449/month for larger operations. Each plan includes a set number of technicians, and office/admin users are always FREE. Save 20% with annual billing."
  },
  {
    question: "How do I get access?",
    answer: "We're currently onboarding contractors through our early access program. Apply for beta access to get hands-on with the full platform, including the AI assistant, guided checklists, and compliance tools. Beta members also lock in founding member pricing."
  }
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-base font-semibold text-white pr-4">{question}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-[15px] text-[#9CA3AF] leading-relaxed pb-6">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

// Generate FAQ schema for rich snippets
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.map(faq => ({
    "@type": "Question",
    "name": faq.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.answer
    }
  }))
};

export default function FAQ() {
  return (
    <div className="min-h-screen bg-[#08090A]">
      <Helmet>
        <title>FAQ - FieldTek AI | Frequently Asked Questions</title>
        <meta name="description" content="Frequently asked questions about FieldTek AI field service management. Learn about features, pricing, AI assistant, and getting started." />
        <link rel="canonical" href="https://fieldtek.ai/faq" />
        <meta property="og:title" content="FAQ - FieldTek AI" />
        <meta property="og:description" content="Everything you need to know about getting started with FieldTek AI." />
        <meta property="og:url" content="https://fieldtek.ai/faq" />
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>
      <Navbar />
      <main className="pt-16">
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-[720px] px-4">
            <div className="text-center mb-12">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
                Frequently Asked Questions
              </h1>
              <p className="text-lg text-[#9CA3AF]">
                Everything you need to know about getting started
              </p>
            </div>

            <div>
              {faqs.map((faq, index) => (
                <FAQItem key={index} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
