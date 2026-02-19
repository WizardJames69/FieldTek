import { PDFOnePagerLayout } from '@/components/pdf/PDFOnePagerLayout';
import { 
  ClipboardCheck, 
  TicketPlus, 
  Database, 
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Camera,
  Cpu,
  Route,
  History,
  Shield,
  TrendingUp,
  Users,
  Wrench,
  Bot,
  BookOpen,
  MessageSquare,
  Check,
  X,
  Minus
} from 'lucide-react';

const coreCapabilities = [
  {
    icon: ClipboardCheck,
    title: 'Smart Checklists',
    features: [
      'Installation workflows',
      'Commissioning procedures',
      'Real-time validation',
      'Auto-documentation',
    ],
  },
  {
    icon: TicketPlus,
    title: 'Service Requests',
    features: [
      'Unit/asset selection',
      'Photo attachments',
      'AI-assisted triage',
      'Auto-routing',
    ],
  },
  {
    icon: Database,
    title: 'Asset Management',
    features: [
      'Serial tracking',
      'Service history',
      'Warranty lookup',
      'Maintenance plans',
    ],
  },
  {
    icon: BarChart3,
    title: 'Insights & Reporting',
    features: [
      'Error patterns',
      'Repeat issues by site',
      'Tech productivity',
      'Training gap ID',
    ],
  },
];

const aiFeatures = [
  { icon: BookOpen, text: 'Trained on manufacturer manuals' },
  { icon: Wrench, text: 'Service & troubleshooting docs' },
  { icon: MessageSquare, text: 'Equipment-specific guidance' },
  { icon: Shield, text: 'Warranty-safe responses' },
];

const featureComparison = [
  { feature: 'Scheduling & Dispatch', starter: true, growth: true, pro: true },
  { feature: 'Customer Management', starter: true, growth: true, pro: true },
  { feature: 'Mobile App Access', starter: true, growth: true, pro: true },
  { feature: 'Basic Reporting', starter: true, growth: true, pro: true },
  { feature: 'Equipment Tracking', starter: false, growth: true, pro: true },
  { feature: 'Invoicing & Payments', starter: 'Basic', growth: true, pro: true },
  { feature: 'AI Field Assistant', starter: false, growth: true, pro: true },
  { feature: 'Advanced Analytics', starter: false, growth: true, pro: true },
  { feature: 'Custom Workflows', starter: false, growth: false, pro: true },
  { feature: 'API Access', starter: false, growth: false, pro: true },
  { feature: 'Multi-location', starter: false, growth: false, pro: true },
  { feature: 'White-label', starter: false, growth: false, pro: 'Ent' },
];

function FeatureCheck({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check className="h-3.5 w-3.5 text-green-600 mx-auto" />;
  }
  if (value === false) {
    return <X className="h-3.5 w-3.5 text-gray-300 mx-auto" />;
  }
  return <span className="text-[9px] text-gray-600 font-medium">{value}</span>;
}

export default function FeaturesOnePager() {
  return (
    <PDFOnePagerLayout documentType="Feature Guide">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          Complete Feature Overview
        </h1>
        <p className="text-xs text-gray-600">
          Everything you need to run smarter field operations
        </p>
      </div>

      {/* Core Capabilities - 2x2 Grid */}
      <section>
        <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
          <ClipboardCheck className="h-3.5 w-3.5 text-orange-500" />
          Core Capabilities
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {coreCapabilities.map((cap, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-orange-100 rounded-md flex items-center justify-center">
                  <cap.icon className="h-3.5 w-3.5 text-orange-600" />
                </div>
                <h3 className="text-xs font-bold text-gray-800">{cap.title}</h3>
              </div>
              <ul className="grid grid-cols-2 gap-1">
                {cap.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-1 text-[10px] text-gray-600">
                    <CheckCircle2 className="h-2.5 w-2.5 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* AI Field Assistant */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bot className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-gray-800 mb-2">AI Field Assistant</h2>
            <p className="text-xs text-gray-600 mb-3">
              Your technicians get instant, equipment-specific guidance powered by your own manuals and documentation.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {aiFeatures.map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                  <feature.icon className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                  {feature.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section>
        <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-green-600" />
          Plan Comparison
        </h2>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left py-2 px-3 font-semibold text-gray-700">Feature</th>
                <th className="text-center py-2 px-2 font-semibold text-gray-700 w-16">Starter<br/><span className="font-normal text-gray-500">$99/mo</span></th>
                <th className="text-center py-2 px-2 font-semibold text-orange-600 bg-orange-50 w-16">Growth<br/><span className="font-normal">$229/mo</span></th>
                <th className="text-center py-2 px-2 font-semibold text-gray-700 w-16">Pro<br/><span className="font-normal text-gray-500">$449/mo</span></th>
              </tr>
            </thead>
            <tbody>
              {featureComparison.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="py-1.5 px-3 text-gray-700">{row.feature}</td>
                  <td className="py-1.5 px-2 text-center">
                    <FeatureCheck value={row.starter} />
                  </td>
                  <td className="py-1.5 px-2 text-center bg-orange-50/50">
                    <FeatureCheck value={row.growth} />
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <FeatureCheck value={row.pro} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] text-gray-500 mt-2 text-center">
          Enterprise plan available with unlimited features, white-label, custom integrations, and SLA guarantee.
        </p>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-4 text-center text-white">
        <h2 className="text-sm font-bold mb-1">Join Our Waitlist for Early Access</h2>
        <p className="text-xs opacity-90 mb-2">Full Professional-tier access • Priority onboarding</p>
        <div className="flex items-center justify-center gap-6 text-xs">
          <div>
            <p className="font-semibold">Demo</p>
            <p className="opacity-80">fieldtek.ai/demo</p>
          </div>
          <div className="w-px h-6 bg-white/30" />
          <div>
            <p className="font-semibold">Waitlist</p>
            <p className="opacity-80">fieldtek.ai/register</p>
          </div>
          <div className="w-px h-6 bg-white/30" />
          <div>
            <p className="font-semibold">Contact</p>
            <p className="opacity-80">info@fieldtek.ai</p>
          </div>
        </div>
      </section>
    </PDFOnePagerLayout>
  );
}
