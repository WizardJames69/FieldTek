import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Copy, Check, Linkedin, User, Building2, FileText, Download, Image, Camera, Calendar, Flame, Droplet, Zap, Wrench, Users, Sparkles, Phone } from "lucide-react";
import { OutreachTab } from "@/components/media-kit/OutreachTab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { industryCalendar, featureSpotlights, industryConfig, postTypeConfig, type CalendarPost, type FeaturePost } from "@/data/mediaKitCalendar";
import { cn } from "@/lib/utils";

function CopyBlock({ title, content, className = "" }: { title: string; content: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative group ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-sm text-foreground">{title}</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap font-mono text-muted-foreground border border-border">
        {content}
      </div>
    </div>
  );
}

const IndustryIcon = ({ industry }: { industry: CalendarPost['industry'] }) => {
  switch (industry) {
    case 'hvac': return <Flame className="h-4 w-4" />;
    case 'plumbing': return <Droplet className="h-4 w-4" />;
    case 'electrical': return <Zap className="h-4 w-4" />;
    case 'mechanical': return <Wrench className="h-4 w-4" />;
    case 'general': return <Users className="h-4 w-4" />;
  }
};

function ContentCalendarTab() {
  const [calendarType, setCalendarType] = useState<'industry' | 'features'>('industry');
  const [industryWeek, setIndustryWeek] = useState<1 | 2>(1);
  const [featureWeek, setFeatureWeek] = useState<1 | 2 | 3>(1);
  const [industryFilter, setIndustryFilter] = useState<CalendarPost['industry'] | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success("Post copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredIndustryPosts = industryCalendar.filter(post => {
    const weekMatch = industryWeek === 1 ? post.day <= 7 : post.day > 7;
    const industryMatch = industryFilter === 'all' || post.industry === industryFilter;
    return weekMatch && industryMatch;
  });

  const filteredFeaturePosts = featureSpotlights.filter(post => post.week === featureWeek);

  return (
    <TabsContent value="calendar" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Content Calendar
          </CardTitle>
          <CardDescription>
            35 ready-to-post pieces for 5 weeks of social media engagement. One-click copy for immediate posting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle between Industry Calendar and Feature Spotlights */}
          <div className="flex gap-2">
            <Button
              variant={calendarType === 'industry' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCalendarType('industry')}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Industry Calendar
              <Badge variant="secondary" className="ml-1">14</Badge>
            </Button>
            <Button
              variant={calendarType === 'features' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCalendarType('features')}
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Feature Spotlights
              <Badge variant="secondary" className="ml-1">21</Badge>
            </Button>
          </div>

          {/* Industry Calendar View */}
          {calendarType === 'industry' && (
            <div className="space-y-4">
              {/* Week Selector */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Week:</span>
                  <div className="flex gap-1">
                    <Button
                      variant={industryWeek === 1 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setIndustryWeek(1)}
                    >
                      Week 1
                    </Button>
                    <Button
                      variant={industryWeek === 2 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setIndustryWeek(2)}
                    >
                      Week 2
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-muted-foreground">Filter:</span>
                  <div className="flex gap-1 flex-wrap">
                    {(['all', 'hvac', 'plumbing', 'electrical', 'mechanical', 'general'] as const).map((ind) => (
                      <Button
                        key={ind}
                        variant={industryFilter === ind ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setIndustryFilter(ind)}
                        className="text-xs"
                      >
                        {ind === 'all' ? 'All' : industryConfig[ind].label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Industry Posts */}
              <div className="space-y-4">
                {filteredIndustryPosts.map((post) => (
                  <div key={`industry-${post.day}`} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">Day {post.day} - {post.dayName}</span>
                        <Badge variant="outline" className={cn("flex items-center gap-1", industryConfig[post.industry].color)}>
                          <IndustryIcon industry={post.industry} />
                          {industryConfig[post.industry].label}
                        </Badge>
                        <Badge className={postTypeConfig[post.postType].color}>
                          {postTypeConfig[post.postType].label}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">Best time: {post.bestTime}</span>
                    </div>
                    <div className="p-4">
                      <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap font-mono text-muted-foreground border border-border mb-3">
                        {post.content}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleCopy(post.content, `industry-${post.day}`)}
                        className="w-full sm:w-auto"
                      >
                        {copiedId === `industry-${post.day}` ? (
                          <>
                            <Check className="h-4 w-4 mr-2 text-green-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Post
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feature Spotlights View */}
          {calendarType === 'features' && (
            <div className="space-y-4">
              {/* Week Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Week:</span>
                <div className="flex gap-1">
                  {([1, 2, 3] as const).map((week) => (
                    <Button
                      key={week}
                      variant={featureWeek === week ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFeatureWeek(week)}
                    >
                      Week {week}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Feature Posts */}
              <div className="space-y-4">
                {filteredFeaturePosts.map((post) => (
                  <div key={`feature-${post.week}-${post.day}`} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/30 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">Day {post.day} - {post.dayName}</span>
                        <Badge className="bg-primary/10 text-primary flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {post.feature}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap font-mono text-muted-foreground border border-border mb-3">
                        {post.content}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleCopy(post.content, `feature-${post.week}-${post.day}`)}
                        className="w-full sm:w-auto"
                      >
                        {copiedId === `feature-${post.week}-${post.day}` ? (
                          <>
                            <Check className="h-4 w-4 mr-2 text-green-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Post
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

export default function MediaKit() {
  const personalHeadline = `Founder & CEO at FieldTek | Building AI-powered field service software that guides techs through every install and keeps contractors warranty-safe | HVAC • Electrical • Plumbing • Mechanical`;

  const personalAbout = `I'm building FieldTek — the AI-powered field service management platform designed for contractors who refuse to accept callbacks, missed warranties, and technicians flying blind.

🔧 THE PROBLEM WE SOLVE
Every day, service companies lose money to:
• Callbacks from undocumented installs
• Voided warranties from improper procedures
• Technicians guessing instead of knowing
• Hours wasted hunting for equipment history

🚀 THE FIELDTEK DIFFERENCE
We built an AI that's actually useful in the field:
• Document-grounded intelligence that cites your actual service manuals
• History-aware diagnostics that detect recurring issue patterns
• Parts prediction based on similar past repairs
• Proactive warranty alerts before they expire

Our platform scales from 2-technician shops to 50+ technician enterprises — with same-day setup, no consultants required.

💡 OUR MISSION
Guide Every Install. Protect Every Warranty.

We're on a mission to give every field technician enterprise-level intelligence without enterprise complexity.

📩 Let's connect: info@fieldtek.ai`;

  const companyTagline = `Guide Every Install. Protect Every Warranty. | AI-powered field service management for trade contractors.`;

  const companyAbout = `FieldTek is the AI-powered field service management platform built for HVAC, electrical, plumbing, and mechanical contractors.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 OUR MISSION
Guide Every Install. Protect Every Warranty.

We believe every technician deserves access to manufacturer-verified intelligence — without digging through binders or calling the office.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 WHAT MAKES FIELDTEK DIFFERENT

🤖 AI That Actually Helps
Our field assistant is document-grounded and history-aware. It references your uploaded service manuals, detects recurring issue patterns, predicts parts based on similar repairs, and proactively warns about expiring warranties.

📱 Built for the Field
Mobile app works offline. Capture photos, update status, and view job details — even with no signal. Everything syncs when you're back online.

👥 Customer Portal Included
Your customers get 24/7 access to submit service requests, view job history, track equipment, and pay invoices online.

⚡ 15-Minute Setup
No consultants. No training sessions. Our onboarding wizard gets you running the same day.

📈 Scales With You
From 2 technicians to 50+. Enterprise features like custom workflows, multi-location support, and API access — without enterprise complexity.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 SIMPLE PRICING
Starting at $99/month. No setup fees. No annual contracts. Office/admin users always FREE.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏢 Industries We Serve
• HVAC Contractors
• Electrical Contractors  
• Plumbing Companies
• Mechanical Contractors
• Multi-trade Service Companies

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📩 CONTACT
Sales: sales@fieldtek.ai
General: info@fieldtek.ai
Website: fieldtek.ai

Try our interactive demo — no account needed.`;

  const launchPost = `🚀 Introducing FieldTek

After watching too many techs flip through binders, call the office for model specs, or guess at procedures — we built something better.

FieldTek is an AI-powered field service platform that:
✅ Guides techs through installs with manufacturer-verified steps
✅ Cites your actual service manuals (no hallucinations)
✅ Detects patterns from your service history
✅ Predicts parts before you're on-site
✅ Alerts you before warranties expire

Built for HVAC, electrical, plumbing & mechanical contractors.
Setup takes 15 minutes. No consultants required.

🔗 Try the interactive demo (no account needed): fieldtek.ai/demo-sandbox

#FieldService #HVAC #Contractors #AI #FSM`;

  const problemPost = `The average HVAC callback costs $150-300+ in labor alone.

Most happen because:
→ Installation steps weren't followed
→ Documentation wasn't captured
→ Warranty procedures weren't verified

What if your techs had a co-pilot that:
• Knew the exact install procedure for every unit
• Required photo documentation at key steps
• Flagged warranty-voiding mistakes before they happen

That's what we built at FieldTek.

Guide Every Install. Protect Every Warranty.

#HVAC #FieldService #Contractors`;

  const socialPosts = [
    {
      id: "dashboard",
      image: "/social/dashboard-jobs-screenshot.png",
      title: "Dashboard Overview",
      caption: `This is what "organized chaos" looks like when you finally tame it.

FieldTek's dashboard gives dispatchers a real-time view of:
📋 Today's jobs at a glance
👥 Technician availability  
⏰ Schedule conflicts before they happen
📊 Daily completion metrics

No more sticky notes. No more spreadsheets. No more "I thought you had that job."

Try our interactive demo: fieldtek.ai/demo-sandbox

#FieldService #HVAC #ContractorLife #FSM`
    },
    {
      id: "ai-assistant",
      image: "/social/ai-assistant-screenshot.png",
      title: "AI Field Assistant",
      caption: `What if every technician had an expert riding along?

That's exactly what we built.

FieldTek's AI assistant:
🔍 Cites YOUR service manuals (no hallucinations)
📖 Pulls from actual equipment history
🔧 Suggests parts based on similar past repairs
⚠️ Warns about warranty-voiding mistakes

It's like having a 20-year veteran in every tech's pocket.

#AI #FieldService #HVAC #TechLife`
    },
    {
      id: "mobile",
      image: "/social/mobile-tech-screenshot.png",
      title: "Mobile Tech View",
      caption: `Your techs don't work at desks. 
Why does your software act like they do?

FieldTek mobile was built for the field:
📱 Works offline (syncs when back online)
📸 Photo documentation at every step
✅ Job checklists that can't be skipped
🎯 One-tap status updates

Built for gloves, not keyboards.

Try it: fieldtek.ai/demo-sandbox

#FieldService #MobileApp #HVAC #Contractors`
    },
    {
      id: "schedule",
      image: "/social/schedule-calendar-screenshot.png",
      title: "Smart Scheduling",
      caption: `Dispatch used to take 2 hours every morning.

Now it takes 15 minutes.

FieldTek's scheduling view shows:
📅 Weekly calendar with drag-and-drop
👷 Technician workload at a glance
🚗 Travel time between jobs
⚡ Urgent jobs flagged automatically

Stop playing Tetris with your technicians' time.

#Dispatching #FieldService #HVAC #Efficiency`
    }
  ];

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Linkedin className="h-6 w-6 text-[#0A66C2]" />
            <div>
              <h1 className="font-display font-bold text-xl">
                <span className="text-foreground">Field</span>
                <span className="text-primary">Tek</span>
                <span className="text-muted-foreground font-normal ml-2">Media Kit</span>
              </h1>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/">← Back to Site</a>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">LinkedIn Content Kit</h2>
          <p className="text-muted-foreground">
            Copy-paste ready content for your personal profile and FieldTek's company page.
          </p>
        </div>

        <Tabs defaultValue="snapshots" className="space-y-6">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="snapshots" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline">Snapshots</span>
            </TabsTrigger>
            <TabsTrigger value="logos" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Logos</span>
            </TabsTrigger>
            <TabsTrigger value="personal" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Personal</span>
            </TabsTrigger>
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Company</span>
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Posts</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="outreach" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Outreach</span>
            </TabsTrigger>
          </TabsList>

          {/* Social Snapshots */}
          <TabsContent value="snapshots" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" />
                  Social Media Snapshots
                </CardTitle>
                <CardDescription>
                  Ready-to-post screenshots with captions. Download the image and copy the caption for LinkedIn, Twitter, or other platforms.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {socialPosts.map((post) => (
                  <div key={post.id} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/30 p-4">
                      <img 
                        src={post.image} 
                        alt={post.title}
                        className="w-full rounded-lg border border-border"
                      />
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-lg">{post.title}</h4>
                        <Button asChild size="sm" variant="outline">
                          <a href={post.image} download={`fieldtek-${post.id}.png`}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </a>
                        </Button>
                      </div>
                      <CopyBlock 
                        title="📝 Caption (click to copy)" 
                        content={post.caption} 
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>


          {/* Logo Assets */}
          <TabsContent value="logos" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5 text-primary" />
                  FieldTek Logo Assets
                </CardTitle>
                <CardDescription>
                  Download official FieldTek logos for use in presentations, articles, and social media.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Primary Logo */}
                  <div className="border border-border rounded-lg p-6 flex flex-col items-center gap-4">
                    <div className="bg-muted/50 rounded-lg p-4 w-full flex items-center justify-center">
                      <img 
                        src="/pwa-icon-512.png" 
                        alt="FieldTek Logo" 
                        className="w-32 h-32 object-contain"
                      />
                    </div>
                    <div className="text-center">
                      <h4 className="font-semibold">Primary Logo</h4>
                      <p className="text-sm text-muted-foreground">512 × 512 px • PNG</p>
                    </div>
                    <Button asChild className="w-full">
                      <a href="/pwa-icon-512.png" download="fieldtek-logo-512.png">
                        <Download className="h-4 w-4 mr-2" />
                        Download PNG
                      </a>
                    </Button>
                  </div>

                  {/* Square Icon */}
                  <div className="border border-border rounded-lg p-6 flex flex-col items-center gap-4">
                    <div className="bg-muted/50 rounded-lg p-4 w-full flex items-center justify-center">
                      <img 
                        src="/pwa-icon-192.png" 
                        alt="FieldTek Icon" 
                        className="w-32 h-32 object-contain"
                      />
                    </div>
                    <div className="text-center">
                      <h4 className="font-semibold">Square Icon</h4>
                      <p className="text-sm text-muted-foreground">192 × 192 px • PNG</p>
                    </div>
                    <Button asChild variant="outline" className="w-full">
                      <a href="/pwa-icon-192.png" download="fieldtek-icon-192.png">
                        <Download className="h-4 w-4 mr-2" />
                        Download PNG
                      </a>
                    </Button>
                  </div>

                  {/* LinkedIn Cover Image */}
                  <div className="border border-border rounded-lg p-6 flex flex-col items-center gap-4 md:col-span-2">
                    <div className="bg-muted/50 rounded-lg p-4 w-full flex items-center justify-center overflow-hidden">
                      <img 
                        src="/fieldtek-linkedin-cover.png?v=4" 
                        alt="FieldTek LinkedIn Cover" 
                        className="w-full max-h-32 object-cover rounded"
                      />
                    </div>
                    <div className="text-center">
                      <h4 className="font-semibold">LinkedIn Cover Image</h4>
                      <p className="text-sm text-muted-foreground">1920 × 512 px • PNG (Recommended for banners)</p>
                    </div>
                    <Button asChild className="w-full max-w-xs">
                      <a href="/fieldtek-linkedin-cover.png" download="fieldtek-linkedin-cover.png">
                        <Download className="h-4 w-4 mr-2" />
                        Download Cover Image
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border">
                  <h4 className="font-semibold text-sm mb-2">Brand Colors</h4>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-primary border border-border"></div>
                      <span className="text-sm font-mono text-muted-foreground">Primary Orange (#F97316)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-[#1F1B18] border border-border"></div>
                      <span className="text-sm font-mono text-muted-foreground">Dark Charcoal (#1F1B18)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Personal Profile */}
          <TabsContent value="personal" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Personal LinkedIn Profile
                </CardTitle>
                <CardDescription>
                  Content for your personal LinkedIn profile. Hover over each section to copy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <CopyBlock 
                  title="Headline (220 characters max)" 
                  content={personalHeadline} 
                />
                <CopyBlock 
                  title="About Section" 
                  content={personalAbout} 
                />
                <div className="bg-muted/30 rounded-lg p-4 border border-border">
                  <h4 className="font-semibold text-sm mb-3">Featured Section Links</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p><strong>🎯 Interactive Demo:</strong> fieldtek.ai/demo-sandbox</p>
                    <p><strong>📄 Sales One-Pager:</strong> fieldtek.ai/one-pager/sales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Company Page */}
          <TabsContent value="company" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  FieldTek Company Page
                </CardTitle>
                <CardDescription>
                  Content for FieldTek's LinkedIn company page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <CopyBlock 
                  title="Tagline (120 characters max)" 
                  content={companyTagline} 
                />
                <CopyBlock 
                  title="About Section" 
                  content={companyAbout} 
                />
                <div className="bg-muted/30 rounded-lg p-4 border border-border">
                  <h4 className="font-semibold text-sm mb-3">Company Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Industry</p>
                      <p className="font-medium">Software Development</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Company Size</p>
                      <p className="font-medium">2-10 employees</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-medium">Privately Held</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Website</p>
                      <p className="font-medium">fieldtek.ai</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-muted-foreground text-sm mb-1">Specialties</p>
                    <p className="text-sm">Field Service Management, HVAC Software, Contractor Software, AI, Workforce Management, Mobile Apps, Trade Contractor Technology</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sample Posts */}
          <TabsContent value="posts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Sample LinkedIn Posts
                </CardTitle>
                <CardDescription>
                  Ready-to-post content for LinkedIn. Customize as needed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <CopyBlock 
                  title="🚀 Launch Announcement" 
                  content={launchPost} 
                />
                <CopyBlock 
                  title="💡 Problem/Solution Post" 
                  content={problemPost} 
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Calendar */}
          <ContentCalendarTab />

          {/* Outreach Templates */}
          <OutreachTab />
        </Tabs>
      </main>
    </div>
    </>
  );
}
