import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

// Plain-language beta privacy policy. Deliberately simple — will be refined
// with counsel before general availability. Keep claims here consistent with
// what the product actually does.

const sections = [
  {
    heading: "What we collect",
    body: "Account information (name, email, company details), the business data your team enters into FieldTek (jobs, clients, equipment, documents, photos, notes), and basic usage information that helps us keep the service running and improve it.",
  },
  {
    heading: "How we use it",
    body: "To provide the FieldTek service to your company, to support you during the beta, and to improve the product. We do not sell your data. Your uploaded documents are used only to answer your own team's questions — they are never used to train shared or third-party AI models, and they are never shown to other companies.",
  },
  {
    heading: "Tenant isolation",
    body: "Every company's data lives in its own tenant. Access is enforced with row-level security on every table, so your data is only visible to your own team members based on their roles.",
  },
  {
    heading: "AI processing",
    body: "When your technicians ask Sentinel AI a question, relevant excerpts from your uploaded documents are sent to our AI provider to generate the answer. AI interactions are logged so we can audit answer quality and safety. We do not use your data to train shared models.",
  },
  {
    heading: "Payments",
    body: "Payments are processed by Stripe. We never see or store your full card details.",
  },
  {
    heading: "Data retention and deletion",
    body: "Your data stays yours. If you leave FieldTek, you can request deletion of your company's data and we will remove it from our production systems.",
  },
  {
    heading: "During the beta",
    body: "FieldTek is in beta and this policy is written in plain language on purpose. It will be expanded and formalized before general availability. If we make material changes, we will notify account owners by email.",
  },
  {
    heading: "Contact",
    body: "Questions about privacy or data handling? Reach out to the founding team through your onboarding contact or the beta application form on this site, and we will respond directly.",
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#09090B]">
      <Helmet>
        <title>Privacy Policy | FieldTek</title>
        <meta name="description" content="FieldTek privacy policy: what we collect, how we use it, tenant isolation, AI processing, and your rights." />
        <link rel="canonical" href="https://fieldtek.ai/privacy" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-sm text-zinc-500 mb-10">Effective July 7, 2026 · Beta edition</p>
          <div className="space-y-8">
            {sections.map((s) => (
              <section key={s.heading}>
                <h2 className="text-lg font-semibold text-zinc-200 mb-2">{s.heading}</h2>
                <p className="text-[15px] text-zinc-400 leading-relaxed">{s.body}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
