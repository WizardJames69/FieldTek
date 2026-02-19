import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Users, Zap } from "lucide-react";
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
import { TIER_CONFIG, FEATURE_COMPARISON, SubscriptionTier } from "@/config/pricing";
import { FloatingOrbs } from "./FloatingOrbs";
import { Card3D } from "./Card3D";

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
    return <Check className="h-4 w-4 text-primary mx-auto" />;
  }
  if (value === false) {
    return <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
  }
  return <span className="text-xs text-foreground">{value}</span>;
}

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
    <section id="pricing" className="relative py-16 bg-background layered-bg overflow-hidden">
      {/* Floating orbs */}
      <FloatingOrbs variant="primary" count={3} intensity="subtle" />
      
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-4 header-spotlight">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Pricing That Scales With You
          </h2>
          <p className="text-lg text-muted-foreground">
            Transparent pricing with no hidden fees. Join our waitlist for early access.
          </p>
          {/* Beta Highlight Banner */}
          <div className="mt-4 inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Beta testers get <span className="font-bold">50% off</span> their first year — <a href="#beta-program" className="underline hover:no-underline">apply now</a>
          </div>
        </div>
        
        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={cn("text-sm font-medium", !isYearly ? "text-foreground" : "text-muted-foreground")}>
            Monthly
          </span>
          <Switch
            checked={isYearly}
            onCheckedChange={setIsYearly}
            className="data-[state=checked]:bg-primary"
          />
          <span className={cn("text-sm font-medium", isYearly ? "text-foreground" : "text-muted-foreground")}>
            Yearly
          </span>
          {isYearly && (
            <span className="bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
              Save 20%
            </span>
          )}
        </div>

        {/* Pricing Cards with 3D effect */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto mb-12">
          {plans.map((plan) => (
            <Card3D key={plan.name} intensity={0.3} glowOnHover={plan.popular}>
              <div
                className={cn(
                  "relative bg-card border rounded-2xl p-5 sm:p-6 flex flex-col h-full",
                  plan.popular
                    ? "border-primary shadow-xl shadow-primary/10 xl:scale-105 z-10"
                    : "border-border hover:border-primary/30 transition-colors"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

              <div className="mb-4">
                <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>

              {/* Pricing Display */}
              <div className="mb-4">
                {plan.monthlyPrice !== null ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        ${isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                      </span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      + ${plan.additionalTechPrice}/additional technician
                    </p>
                  </>
                ) : (
                  <div>
                    <span className="text-3xl font-bold text-foreground">Custom</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tailored to your needs
                    </p>
                  </div>
                )}
              </div>

              {/* Included Resources */}
              <div className="flex flex-col gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-foreground">
                    <strong>{plan.includedTechs}</strong> technicians included
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-foreground">
                    <strong>{plan.officeUsers}</strong> office users{" "}
                    <span className="text-primary font-medium">FREE</span>
                  </span>
                </div>
                {plan.jobsPerMonth !== "Unlimited" && (
                  <p className="text-xs text-muted-foreground">
                    Up to {plan.jobsPerMonth} jobs/month
                  </p>
                )}
              </div>

              {/* Features List */}
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-foreground text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

                {plan.tier === "enterprise" ? (
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="w-full"
                  >
                    <Link to={plan.href}>{plan.cta}</Link>
                  </Button>
                ) : (
                  <Button
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                    className={cn("w-full", plan.popular && "btn-3d")}
                    onClick={onJoinWaitlist}
                  >
                    Join Waitlist
                  </Button>
                )}
              </div>
            </Card3D>
          ))}
        </div>

        {/* Feature Comparison Table - Hidden on mobile, shown on tablet+ */}
        <div className="max-w-6xl mx-auto hidden md:block">
          <h3 className="text-xl font-bold text-foreground text-center mb-6">
            Compare All Features
          </h3>
          <div className="backdrop-blur-xl bg-card/80 border border-border/50 rounded-xl overflow-hidden shadow-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 border-b border-border/50">
                  <TableHead className="w-[180px] lg:w-[220px] font-semibold whitespace-nowrap text-sm py-2.5">Feature</TableHead>
                  <TableHead className="text-center font-semibold whitespace-nowrap min-w-[80px] text-sm py-2.5">Starter</TableHead>
                  <TableHead className="text-center font-semibold bg-primary/5 whitespace-nowrap min-w-[80px] text-sm py-2.5">Growth</TableHead>
                  <TableHead className="text-center font-semibold whitespace-nowrap min-w-[80px] text-sm py-2.5">Professional</TableHead>
                  <TableHead className="text-center font-semibold whitespace-nowrap min-w-[80px] text-sm py-2.5">Enterprise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleFeatures.map((row, idx) => (
                  <TableRow 
                    key={row.feature}
                    className={cn(
                      "transition-colors hover:bg-muted/40",
                      idx % 2 === 0 && "bg-muted/20"
                    )}
                  >
                    <TableCell className="font-medium whitespace-nowrap text-sm py-2">{row.feature}</TableCell>
                    <TableCell className="text-center py-2">
                      <FeatureValue value={row.starter} />
                    </TableCell>
                    <TableCell className="text-center bg-primary/5 py-2">
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
            
            {/* Expand/Collapse Button */}
            {featureComparison.length > 6 && (
              <button
                onClick={() => setShowAllFeatures(!showAllFeatures)}
                className="w-full py-3 text-sm font-medium text-primary hover:bg-primary/5 border-t border-border/50 transition-colors flex items-center justify-center gap-2"
              >
                {showAllFeatures ? (
                  <>Show Less Features <span className="text-xs">↑</span></>
                ) : (
                  <>Show All {featureComparison.length} Features <span className="text-xs">↓</span></>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Feature Comparison - Simplified cards per tier */}
        <div className="md:hidden max-w-lg mx-auto">
          <h3 className="text-lg font-bold text-foreground text-center mb-4">
            Compare Features
          </h3>
          <div className="space-y-3">
            {plans.map((plan) => (
              <details key={plan.name} className="group backdrop-blur-xl bg-card/80 border border-border/50 rounded-xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between p-3 cursor-pointer list-none">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-semibold text-sm",
                      plan.popular && "text-primary"
                    )}>{plan.name}</span>
                    {plan.popular && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full animate-pulse">Popular</span>
                    )}
                  </div>
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform duration-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </summary>
                <div className="px-3 pb-3 pt-2 border-t border-border/50 space-y-1.5">
                  {featureComparison.map((row) => {
                    const value = row[plan.tier as keyof typeof row];
                    if (value === false) return null;
                    return (
                      <div key={row.feature} className="flex items-center gap-2 text-xs">
                        <Check className="h-3 w-3 text-primary shrink-0" />
                        <span className="text-foreground">{row.feature}</span>
                        {typeof value === 'string' && value !== 'true' && (
                          <span className="text-[10px] text-muted-foreground ml-auto">({value})</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        </div>

        <p className="text-center text-muted-foreground text-sm mt-8">
          All prices in USD. Need a custom solution?{" "}
          <a href="/consultation" className="text-primary hover:underline">
            Schedule a consultation
          </a>
        </p>
      </div>
    </section>
  );
}
