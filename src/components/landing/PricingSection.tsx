import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Users, Zap, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TIER_CONFIG, FEATURE_COMPARISON, SubscriptionTier } from "@/config/pricing";
import { motion } from "framer-motion";

// Transform TIER_CONFIG into an array for rendering (exclude trial)
const plans = (["starter", "growth", "professional", "enterprise"] as SubscriptionTier[]).map(tier => {
  const config = TIER_CONFIG[tier];
  return {
    name: config.name,
    description: config.description,
    monthlyPrice: config.monthlyPrice,
    yearlyPrice: config.yearlyPrice,
    includedTechs: config.includedTechs,
    additionalTechPrice: config.additionalTechPrice,
    officeUsers: config.officeUsers,
    jobsPerMonth: config.jobsPerMonth,
    features: config.features,
    cta: config.cta,
    href: config.href,
    popular: config.popular,
    tier: tier,
  };
});

// Transform FEATURE_COMPARISON for rendering
const featureComparison = FEATURE_COMPARISON.map(row => ({
  feature: row.feature,
  starter: row.starter,
  growth: row.growth,
  professional: row.professional,
  enterprise: row.enterprise,
}));

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check className="h-4 w-4 text-orange-500 mx-auto" />;
  }
  if (value === false) {
    return <X className="h-4 w-4 text-zinc-700 mx-auto" />;
  }
  return <span className="text-xs text-zinc-300">{value}</span>;
}

const faqItems = [
  {
    question: "Can I change plans at any time?",
    answer: "Yes. You can upgrade or downgrade your plan at any time. When upgrading, you'll be prorated for the remainder of your billing cycle. When downgrading, the change takes effect at the start of your next billing cycle.",
  },
  {
    question: "What happens when I approach my plan limits?",
    answer: "We'll notify you when you're approaching your plan limits. You can upgrade at any time to unlock higher limits. We won't cut off your service mid-job. You'll have a grace period to upgrade or adjust your usage.",
  },
  {
    question: "Is there a setup fee?",
    answer: "No. There are no setup fees, onboarding fees, or hidden charges. You only pay for your plan and any additional technician seats you add.",
  },
  {
    question: "Do you offer discounts for annual billing?",
    answer: "Yes, annual billing saves you 20% compared to monthly billing. Toggle the billing switch above to see annual pricing for each plan.",
  },
  {
    question: "How do I get started?",
    answer: "We're currently in beta. Join our waitlist to get early access and pricing. No credit card will be required to start. You can also explore our interactive demo sandbox to see the full platform in action before signing up.",
  },
];

interface PricingSectionProps {
  onJoinWaitlist?: () => void;
}

export function PricingSection({ onJoinWaitlist }: PricingSectionProps) {
  const [isYearly, setIsYearly] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  const visibleFeatures = showAllFeatures
    ? featureComparison
    : featureComparison.slice(0, 6);

  return (
    <section id="pricing" className="relative py-16 md:py-24 lg:py-32 bg-[#09090B] overflow-hidden">
      <div className="mx-auto max-w-7xl px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-2xl mx-auto mb-4"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15] mb-4">
            Simple pricing that scales with your team
          </h2>
          <p className="text-lg text-zinc-400">
            Transparent pricing that scales with your team. No long-term contracts.
          </p>
        </motion.div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={cn("text-sm font-medium", !isYearly ? "text-white" : "text-zinc-500")}>
            Monthly
          </span>
          <Switch
            checked={isYearly}
            onCheckedChange={setIsYearly}
            className="data-[state=checked]:bg-orange-500"
          />
          <span className={cn("text-sm font-medium", isYearly ? "text-white" : "text-zinc-500")}>
            Yearly
          </span>
          {isYearly && (
            <span className="bg-orange-500/10 text-orange-500 text-xs font-semibold px-2.5 py-1 rounded-full">
              Save 20%
            </span>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className={cn(
                "relative rounded-2xl p-5 sm:p-6 flex flex-col h-full border transition-colors duration-300",
                plan.popular
                  ? "bg-[#161819] border-orange-500/50 shadow-lg shadow-orange-500/5 xl:scale-105 z-10"
                  : "bg-[#161819] border-white/[0.06] hover:border-white/[0.12]"
              )}
            >
              {/* Popular badge + orange top accent */}
              {plan.popular && (
                <>
                  <div className="absolute inset-x-0 top-0 h-[3px] bg-orange-500 rounded-t-2xl" />
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-orange-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                </>
              )}

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  {plan.popular && (
                    <span className="text-[10px] font-semibold bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full">
                      Most Popular
                    </span>
                  )}
                </div>
                <p className="text-zinc-500 text-sm">{plan.description}</p>
              </div>

              {/* Pricing Display */}
              <div className="mb-4">
                {plan.monthlyPrice !== null ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white">
                        ${isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                      </span>
                      <span className="text-zinc-500">/mo</span>
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">
                      + ${plan.additionalTechPrice}/additional technician
                    </p>
                  </>
                ) : (
                  <div>
                    <span className="text-3xl font-bold text-white">Custom</span>
                    <p className="text-sm text-zinc-500 mt-1">
                      Tailored to your needs
                    </p>
                  </div>
                )}
              </div>

              {/* Included Resources */}
              <div className="flex flex-col gap-2 mb-4 p-3 bg-white/[0.03] rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-orange-500" />
                  <span className="text-zinc-300">
                    <strong className="text-white">{plan.includedTechs}</strong> technicians included
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-orange-500" />
                  <span className="text-zinc-300">
                    <strong className="text-white">{plan.officeUsers}</strong> office users{" "}
                    <span className="text-orange-500 font-medium">FREE</span>
                  </span>
                </div>
                {plan.jobsPerMonth !== "Unlimited" && (
                  <p className="text-xs text-zinc-500">
                    Up to {plan.jobsPerMonth} jobs/month
                  </p>
                )}
              </div>

              {/* Features List */}
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                    <span className="text-zinc-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.tier === "enterprise" ? (
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-full bg-transparent border-white/[0.15] text-white hover:border-white/30 hover:bg-white/5"
                >
                  <Link to={plan.href}>{plan.cta}</Link>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className={cn(
                    "w-full",
                    plan.popular
                      ? "bg-orange-500 hover:bg-orange-600 text-white border-0"
                      : "bg-transparent border border-white/[0.15] text-white hover:border-white/30 hover:bg-white/5"
                  )}
                  onClick={onJoinWaitlist}
                >
                  {plan.cta}
                </Button>
              )}
            </motion.div>
          ))}
        </div>

        {/* Feature Comparison Table - Hidden on mobile */}
        <div className="max-w-6xl mx-auto hidden md:block mb-16">
          <h3 className="text-xl font-bold text-white text-center mb-6">
            Compare All Features
          </h3>
          <div className="bg-[#111214] border border-white/[0.06] rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#161819] border-b border-white/[0.06]">
                  <TableHead className="w-[180px] lg:w-[220px] font-semibold whitespace-nowrap text-sm py-2.5 text-zinc-300">Feature</TableHead>
                  <TableHead className="text-center font-semibold whitespace-nowrap min-w-[80px] text-sm py-2.5 text-zinc-300">Starter</TableHead>
                  <TableHead className="text-center font-semibold bg-orange-500/5 whitespace-nowrap min-w-[80px] text-sm py-2.5 text-zinc-300">Growth</TableHead>
                  <TableHead className="text-center font-semibold whitespace-nowrap min-w-[80px] text-sm py-2.5 text-zinc-300">Professional</TableHead>
                  <TableHead className="text-center font-semibold whitespace-nowrap min-w-[80px] text-sm py-2.5 text-zinc-300">Enterprise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleFeatures.map((row, idx) => (
                  <TableRow
                    key={row.feature}
                    className={cn(
                      "transition-colors hover:bg-white/[0.02] border-white/[0.04]",
                      idx % 2 === 0 && "bg-white/[0.01]"
                    )}
                  >
                    <TableCell className="font-medium whitespace-nowrap text-sm py-2 text-zinc-300">{row.feature}</TableCell>
                    <TableCell className="text-center py-2">
                      <FeatureValue value={row.starter} />
                    </TableCell>
                    <TableCell className="text-center bg-orange-500/5 py-2">
                      <FeatureValue value={row.growth} />
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <FeatureValue value={row.professional} />
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <FeatureValue value={row.enterprise} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {featureComparison.length > 6 && (
              <button
                onClick={() => setShowAllFeatures(!showAllFeatures)}
                className="w-full py-3 text-sm font-medium text-orange-500 hover:bg-white/[0.02] border-t border-white/[0.06] transition-colors flex items-center justify-center gap-2"
              >
                {showAllFeatures ? (
                  <>Show Less Features <ChevronDown className="h-3.5 w-3.5 rotate-180" /></>
                ) : (
                  <>Show All {featureComparison.length} Features <ChevronDown className="h-3.5 w-3.5" /></>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Feature Comparison */}
        <div className="md:hidden max-w-lg mx-auto mb-16">
          <h3 className="text-lg font-bold text-white text-center mb-4">
            Compare Features
          </h3>
          <div className="space-y-3">
            {plans.map((plan) => (
              <details key={plan.name} className="group bg-[#111214] border border-white/[0.06] rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-semibold text-sm",
                      plan.popular ? "text-orange-500" : "text-white"
                    )}>{plan.name}</span>
                    {plan.popular && (
                      <span className="text-[10px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded-full">Popular</span>
                    )}
                  </div>
                  <span className="text-zinc-500 group-open:rotate-180 transition-transform duration-200">
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </summary>
                <div className="px-4 pb-4 pt-2 border-t border-white/[0.06] space-y-1.5">
                  {featureComparison.map((row) => {
                    const value = row[plan.tier as keyof typeof row];
                    if (value === false) return null;
                    return (
                      <div key={row.feature} className="flex items-center gap-2 text-xs">
                        <Check className="h-3 w-3 text-orange-500 shrink-0" />
                        <span className="text-zinc-300">{row.feature}</span>
                        {typeof value === 'string' && value !== 'true' && (
                          <span className="text-[10px] text-zinc-600 ml-auto">({value})</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h3 className="text-2xl md:text-3xl font-bold text-white text-center mb-8">
            Frequently Asked Questions
          </h3>
          <Accordion type="single" collapsible className="space-y-3">
            {faqItems.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-[#111214] border border-white/[0.06] rounded-xl px-5 data-[state=open]:border-white/[0.12]"
              >
                <AccordionTrigger className="text-sm font-medium text-white hover:no-underline py-4">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-zinc-400 leading-relaxed pb-4">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <p className="text-center text-zinc-500 text-sm mt-12">
          All prices in USD. Need a custom solution?{" "}
          <Link to="/consultation" className="text-orange-500 hover:underline">
            Schedule a consultation
          </Link>
        </p>
      </div>
    </section>
  );
}
