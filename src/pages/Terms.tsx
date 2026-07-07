import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

// Plain-language beta terms. Deliberately simple — will be refined with
// counsel before general availability.

const sections = [
  {
    heading: "The service",
    body: "FieldTek is field service management software with an AI assistant (Sentinel) that answers questions from documentation your company uploads. FieldTek is currently in beta: features are evolving, and some capabilities shown as “coming” on our website are being built with design partners and are not yet available.",
  },
  {
    heading: "Your account and data",
    body: "You are responsible for your account credentials and for the data your team enters. Your data remains yours — see our Privacy Policy for how it is handled. You can request deletion of your company's data if you stop using FieldTek.",
  },
  {
    heading: "Professional judgment and safety",
    body: "Sentinel AI provides informational guidance drawn from your uploaded documentation. It is not a substitute for professional judgment, licensure, manufacturer instructions, or applicable codes and regulations. Always verify safety-critical work against the manufacturer's documentation and the requirements of your local authority having jurisdiction. Licensed professionals remain responsible for the work they perform.",
  },
  {
    heading: "Acceptable use",
    body: "Don't misuse the service: no unauthorized access attempts, no uploading content you don't have the right to use, no using the platform to violate the law. We may suspend accounts that put the service or other customers at risk.",
  },
  {
    heading: "Billing and trials",
    body: "Paid plans are billed through Stripe, monthly or annually. New accounts start with a 30-day free trial. You can cancel at any time; paid access continues through the end of the current billing period.",
  },
  {
    heading: "Beta terms",
    body: "During the beta, the service is provided as-is, without warranties of any kind. We work closely with beta members and fix issues fast, but occasional bugs, changes, and downtime are part of beta software. To the maximum extent permitted by law, FieldTek's liability is limited to the amounts you paid us in the twelve months before a claim.",
  },
  {
    heading: "Changes",
    body: "We may update these terms as the product matures. If we make material changes, we will notify account owners by email before they take effect.",
  },
  {
    heading: "Contact",
    body: "Questions about these terms? Reach out to the founding team through your onboarding contact or the beta application form on this site.",
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#09090B]">
      <Helmet>
        <title>Terms of Service | FieldTek</title>
        <meta name="description" content="FieldTek terms of service: the beta service, your data, professional judgment, acceptable use, billing, and liability." />
        <link rel="canonical" href="https://fieldtek.ai/terms" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Terms of Service</h1>
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
