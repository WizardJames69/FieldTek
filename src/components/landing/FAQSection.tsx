import { Helmet } from "react-helmet-async";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How is FieldTek different from ServiceTitan?",
    answer: "FieldTek delivers enterprise-level features without enterprise complexity. You get scheduling, dispatch, invoicing, and a mobile app with same-day setup — no consultants or lengthy implementations required. Our interactive demo lets you explore everything before signing up, and our AI assistant is trained on YOUR uploaded manuals and learns from your service history for brand-specific, model-specific guidance in the field."
  },
  {
    question: "Can I switch from my current FSM software?",
    answer: "Absolutely! We offer free data migration assistance. Export your customers, equipment, and job history as CSV files, and our import tools (or our team) will help you transfer everything. Most teams are fully migrated within a day, not months."
  },
  {
    question: "Is FieldTek powerful enough for a growing team?",
    answer: "Yes. FieldTek scales from 2 to 50+ technicians. You get enterprise features like custom workflows, multi-location support, API access, and advanced analytics — without the enterprise complexity or pricing. Many of our customers switched from 'big name' tools and haven't looked back."
  },
  {
    question: "How long does it take to get started?",
    answer: "You can be up and running in under 15 minutes. Our onboarding wizard guides you through setting up your company profile, adding team members, and configuring your first job types. No consultants required, no training sessions, no technical expertise needed."
  },
  {
    question: "What is the interactive demo?",
    answer: "Our demo sandbox lets you explore FieldTek with realistic sample data — no account needed. You'll see a full day of jobs, customer records, equipment history, and even try the AI assistant. It's the fastest way to understand how FieldTek fits your workflow before committing to a trial."
  },
  {
    question: "Does the AI learn from our service history?",
    answer: "Yes! FieldTek's AI doesn't just reference manuals — it analyzes your complete service history. When a technician opens a job, the AI automatically surfaces previous visits and what was done, recurring issue patterns ('This is the 4th refrigerant issue on this unit'), parts commonly needed for similar repairs, and proactive warranty expiration alerts. This context-aware intelligence helps techs diagnose faster and come prepared with the right parts."
  },
  {
    question: "How does the AI assistant compare to competitors?",
    answer: "Most FSM tools either have no AI or use generic chatbots. FieldTek's AI is document-grounded and history-aware — it references your uploaded service manuals for brand-specific answers, detects recurring issue patterns across your service history, predicts likely parts based on similar past repairs, and proactively warns about expiring warranties. Plus, incoming service requests are automatically analyzed by AI to suggest priority levels and job types."
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
    answer: "No setup fees, no annual contracts, no hidden costs. Plans start at $99/month for small teams and scale to $449/month for larger operations. Each plan includes a set number of technicians, and office/admin users are always FREE. Save 20% with annual billing. Compare that to competitors who charge per-seat for everyone plus implementation fees."
  },
  {
    question: "Can I try before I buy?",
    answer: "Absolutely! Explore our interactive demo sandbox to see the full platform in action — no signup required. We're currently in beta, so join our waitlist to get early access when we launch. You can also book a personalized demo with our team to see how the platform fits your specific workflow."
  }
];

export function FAQSection() {
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

  return (
    <section id="faq" className="relative py-12 md:py-16 bg-muted/30 overflow-hidden">
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8 header-spotlight">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to know about getting started
          </p>
        </div>

        <div className="section-glass p-4 md:p-6">
          <Accordion type="single" collapsible className="w-full space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="faq-glass rounded-lg px-5 data-[state=open]:shadow-md transition-shadow border-0"
              >
                <AccordionTrigger className="text-left text-foreground hover:text-primary hover:no-underline py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
