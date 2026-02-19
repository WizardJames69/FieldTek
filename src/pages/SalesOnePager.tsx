import { PDFOnePagerLayout } from '@/components/pdf/PDFOnePagerLayout';
import { 
  Clock, 
  TrendingUp, 
  Smartphone, 
  CreditCard,
  Users,
  Wrench,
  Headphones,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Zap
} from 'lucide-react';

const problems = [
  { icon: AlertTriangle, text: 'High callback rates costing $150+ per truck roll' },
  { icon: Users, text: 'Inconsistent quality across technicians' },
  { icon: CreditCard, text: 'Warranty claims denied due to poor documentation' },
  { icon: BarChart3, text: 'No visibility into field operations' },
];

const rolesBenefits = [
  {
    title: 'Field Technicians',
    benefits: ['Step-by-step guidance', 'AI troubleshooting', 'Fewer callbacks'],
  },
  {
    title: 'Dispatch & Ops',
    benefits: ['Job context visibility', 'Smart routing', 'Real-time updates'],
  },
  {
    title: 'Leadership',
    benefits: ['Reduced liability', 'Compliance docs', 'Data-driven insights'],
  },
];

const differentiators = [
  { icon: Clock, title: '15-Min Setup', desc: 'No consultants needed' },
  { icon: TrendingUp, title: 'Save $15K+', desc: 'Per year vs competitors' },
  { icon: Smartphone, title: 'AI Assistant', desc: 'Trained on your manuals' },
  { icon: CreditCard, title: 'No Contracts', desc: 'Cancel anytime' },
];

const pricing = [
  { name: 'Starter', price: '$99', techs: '2 techs' },
  { name: 'Growth', price: '$229', techs: '5 techs', popular: true },
  { name: 'Professional', price: '$449', techs: '10 techs' },
];

export default function SalesOnePager() {
  return (
    <PDFOnePagerLayout documentType="Sales Sheet">
      {/* Headline */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          AI-Driven Field Operations
          <span className="text-orange-500"> for Skilled Trade Companies</span>
        </h1>
        <p className="text-sm text-gray-600 max-w-xl mx-auto">
          Standardize installs • Reduce callbacks • Protect warranties • Unlock job-level intelligence
        </p>
      </div>

      {/* The Problem */}
      <section className="bg-red-50 rounded-lg p-4">
        <h2 className="text-sm font-bold text-red-800 uppercase tracking-wide mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          The Problem
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {problems.map((problem, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-700">
              <problem.icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{problem.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* The Solution - Role-Based Benefits */}
      <section>
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          The Solution
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {rolesBenefits.map((role, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
              <h3 className="text-xs font-bold text-gray-800 mb-2">{role.title}</h3>
              <ul className="space-y-1">
                {role.benefits.map((benefit, j) => (
                  <li key={j} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Zap className="h-3 w-3 text-orange-500 flex-shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Why FieldTek */}
      <section>
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-orange-500" />
          Why FieldTek?
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {differentiators.map((item, i) => (
            <div key={i} className="text-center bg-orange-50 rounded-lg p-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <item.icon className="h-4 w-4 text-orange-600" />
              </div>
              <h3 className="text-xs font-bold text-gray-800">{item.title}</h3>
              <p className="text-[10px] text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section>
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          Pricing at a Glance
        </h2>
        <div className="flex items-center justify-center gap-4">
          {pricing.map((plan, i) => (
            <div 
              key={i} 
              className={`flex-1 text-center p-3 rounded-lg border-2 ${
                plan.popular 
                  ? 'border-orange-500 bg-orange-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              {plan.popular && (
                <span className="text-[9px] font-bold text-orange-600 uppercase">Most Popular</span>
              )}
              <h3 className="text-sm font-bold text-gray-800">{plan.name}</h3>
              <p className="text-lg font-bold text-orange-600">{plan.price}<span className="text-xs text-gray-500">/mo</span></p>
              <p className="text-[10px] text-gray-500">{plan.techs} included</p>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-gray-500 mt-2">
          Join our waitlist for early access • All features included
        </p>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-4 text-center text-white">
        <h2 className="text-sm font-bold mb-2">Ready to Transform Your Field Operations?</h2>
        <div className="flex items-center justify-center gap-6 text-xs">
          <div>
            <p className="font-semibold">Try the Demo</p>
            <p className="opacity-80">fieldtek.ai/demo</p>
          </div>
          <div className="w-px h-8 bg-white/30" />
          <div>
            <p className="font-semibold">Join Waitlist</p>
            <p className="opacity-80">fieldtek.ai</p>
          </div>
          <div className="w-px h-8 bg-white/30" />
          <div>
            <p className="font-semibold">Contact Sales</p>
            <p className="opacity-80">sales@fieldtek.ai</p>
          </div>
        </div>
      </section>
    </PDFOnePagerLayout>
  );
}
