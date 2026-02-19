// Types for outreach templates
export interface EmailTemplate {
  id: string;
  industry: 'hvac' | 'plumbing' | 'electrical' | 'mechanical';
  type: 'cold' | 'followup';
  subject: string;
  body: string;
}

export interface PhoneScript {
  id: string;
  industry: 'hvac' | 'plumbing' | 'electrical' | 'mechanical';
  type: 'call' | 'voicemail';
  title: string;
  content: string;
}

export const industryOutreachConfig = {
  hvac: { label: 'HVAC', color: 'text-orange-600 border-orange-300' },
  plumbing: { label: 'Plumbing', color: 'text-blue-600 border-blue-300' },
  electrical: { label: 'Electrical', color: 'text-yellow-600 border-yellow-300' },
  mechanical: { label: 'Mechanical', color: 'text-slate-600 border-slate-300' },
} as const;

export const emailTemplates: EmailTemplate[] = [
  // HVAC Emails
  {
    id: 'hvac-cold',
    industry: 'hvac',
    type: 'cold',
    subject: 'Reducing HVAC callbacks with better documentation',
    body: `Hi [Name],

I noticed [Company Name] handles residential/commercial HVAC service in [Area].

Quick question: How much are callbacks costing you this year?

We've built FieldTek specifically for HVAC contractors who are tired of:
• Warranty claims denied for "lack of documentation"
• Techs calling the office for model specs
• Callbacks from installs that weren't documented properly

Our AI assistant cites your actual service manuals and knows the history at every address. No guessing. No callbacks.

Worth a 15-minute demo?

[Signature]

P.S. We're offering 50% off to our first 10 beta companies.`
  },
  {
    id: 'hvac-followup',
    industry: 'hvac',
    type: 'followup',
    subject: 'Re: Quick question about callbacks',
    body: `Hi [Name],

Following up on my note last week about reducing HVAC callbacks.

I know you're busy—heating season doesn't wait.

Here's what one of our beta customers told us:
"We went from 8 callbacks in December to 2. The AI literally caught a refrigerant procedure our newest tech was about to skip."

If you're curious, I put together a 3-minute video walkthrough showing exactly how it works for HVAC crews.

Want me to send it over?

[Signature]

P.S. Our beta discount (50% off) ends soon—only 4 spots left.`
  },

  // Plumbing Emails
  {
    id: 'plumbing-cold',
    industry: 'plumbing',
    type: 'cold',
    subject: 'Fewer emergency callbacks, more first-time fixes',
    body: `Hi [Name],

I came across [Company Name] while researching plumbing contractors in [Area].

Quick question: How often do your techs have to make a second trip because they didn't have the right parts?

We built FieldTek for plumbing companies dealing with:
• Emergency calls that turn into callbacks because parts weren't available
• Techs spending more time on the phone than on the job
• Customer trust issues from inconsistent service

Our AI predicts parts based on similar past repairs and works offline—even in basements with no signal.

Interested in a quick demo?

[Signature]

P.S. We're offering 50% off to our first 10 beta companies.`
  },
  {
    id: 'plumbing-followup',
    industry: 'plumbing',
    type: 'followup',
    subject: 'Re: The parts prediction thing',
    body: `Hi [Name],

Wanted to circle back on FieldTek.

I know plumbing emergencies don't leave much time for software demos—so here's the short version:

Our AI looks at past service history and tells your tech what parts they'll likely need BEFORE they roll out. One beta company reduced parts-related return trips by 35% in their first month.

The whole platform works offline too—which matters when you're in a crawlspace with zero bars.

Worth 15 minutes to see if it could help [Company Name]?

[Signature]

P.S. Only 3 beta spots left at 50% off.`
  },

  // Electrical Emails
  {
    id: 'electrical-cold',
    industry: 'electrical',
    type: 'cold',
    subject: 'Passing inspections the first time, every time',
    body: `Hi [Name],

I noticed [Company Name] handles commercial/residential electrical work in [Area].

Quick question: How often do failed inspections or scope creep eat into your margins?

We built FieldTek for electrical contractors who are tired of:
• Inspection failures from missed code requirements
• Scope creep without documented change orders
• Techs unsure about NEC compliance on complex installs

Our AI references your code documents and creates timestamped checklists at every step. Inspectors love the documentation. So do your customers.

Would a 15-minute demo be worth your time?

[Signature]

P.S. We're offering 50% off to our first 10 beta companies.`
  },
  {
    id: 'electrical-followup',
    industry: 'electrical',
    type: 'followup',
    subject: 'Re: Inspection documentation',
    body: `Hi [Name],

Following up on my note about FieldTek.

I know electrical work has zero margin for error—one failed inspection can cost you a week.

Here's what our beta users are telling us:
"The timestamped photo checklists saved us during a dispute with a GC. We had documentation for every step."

Our AI also flags scope changes in real-time, so your team can get written approval before extra work starts.

Want a quick walkthrough?

[Signature]

P.S. 50% beta discount ends soon—let me know if you'd like to lock it in.`
  },

  // Mechanical Emails
  {
    id: 'mechanical-cold',
    industry: 'mechanical',
    type: 'cold',
    subject: 'Reducing unplanned breakdowns with smarter PM tracking',
    body: `Hi [Name],

I found [Company Name] while looking into mechanical contractors in [Area].

Quick question: How much are unplanned breakdowns costing your commercial clients?

We built FieldTek for mechanical contractors dealing with:
• PM schedules that slip through the cracks
• No visibility into asset history across sites
• Breakdown calls that could've been prevented

Our AI tracks every piece of equipment, predicts maintenance needs, and alerts your team before issues become emergencies.

Would a 15-minute demo be helpful?

[Signature]

P.S. We're offering 50% off to our first 10 beta companies.`
  },
  {
    id: 'mechanical-followup',
    industry: 'mechanical',
    type: 'followup',
    subject: 'Re: PM scheduling and asset tracking',
    body: `Hi [Name],

Wanted to follow up on FieldTek.

I know managing PM contracts across multiple sites is a nightmare—especially when history lives in spreadsheets or someone's head.

Here's what one mechanical contractor told us:
"We finally have one place to see every asset, every service history, every upcoming PM. Our clients are impressed."

The AI also flags recurring issues so you can propose upgrades or replacements proactively—turning service calls into revenue.

Interested in a quick demo?

[Signature]

P.S. Only a few beta spots left at 50% off.`
  }
];

export const phoneScripts: PhoneScript[] = [
  // HVAC Scripts
  {
    id: 'hvac-call',
    industry: 'hvac',
    type: 'call',
    title: 'HVAC Cold Call Script',
    content: `OPENING:
"Hi [Name], this is [Your Name] with FieldTek. I'm reaching out because we work with HVAC contractors who are looking to reduce callbacks and protect warranties. Do you have 2 minutes?"

IF YES:
"Great. Quick question — how are your techs currently accessing service manuals and equipment history when they're on-site?"

[Listen for pain points]

VALUE PROPOSITION:
"That's exactly what we're solving. FieldTek gives every tech an AI assistant that knows your service manuals, sees the full history at each address, and guides them through installs step-by-step.

One of our HVAC customers reduced callbacks by 40% in the first month."

OBJECTION - "We already have software":
"Totally understand. Most FSM tools handle scheduling—but they don't help techs in the moment. Our AI actually guides them through procedures and warns about warranty-voiding mistakes. It's the missing piece."

OBJECTION - "We're too busy right now":
"I hear you—heating season is brutal. That's actually why this helps: less time on callbacks means more time on new jobs. Would it make sense to schedule something for after the rush?"

CLOSE:
"Would you be open to a 15-minute demo to see if it could help [Company Name]?"

IF BUSY:
"No problem. When would be a better time to connect? I can also send you a quick video overview."

CLOSING:
"Great, I'll send that over. And just so you know, we're offering 50% off for our first 10 beta companies. Thanks for your time, [Name]."`
  },
  {
    id: 'hvac-voicemail',
    industry: 'hvac',
    type: 'voicemail',
    title: 'HVAC Voicemail Script',
    content: `"Hi [Name], this is [Your Name] with FieldTek.

I'm reaching out because we help HVAC contractors reduce callbacks with an AI that guides techs through installs and cites their actual service manuals.

One of our beta customers reduced callbacks by 40% in their first month.

I'd love to show you how it works—takes about 15 minutes.

You can reach me at [Phone Number] or just reply to the email I'll send over.

Thanks, [Name]. Talk soon."`
  },

  // Plumbing Scripts
  {
    id: 'plumbing-call',
    industry: 'plumbing',
    type: 'call',
    title: 'Plumbing Cold Call Script',
    content: `OPENING:
"Hi [Name], this is [Your Name] with FieldTek. We work with plumbing contractors who want to reduce return trips and improve first-time fix rates. Do you have 2 minutes?"

IF YES:
"Great. Quick question—when your techs roll out on a call, how do they know what parts they'll need?"

[Listen for pain points]

VALUE PROPOSITION:
"That's exactly what we're solving. FieldTek's AI looks at the service history and predicts what parts your tech will likely need before they leave. It also works completely offline—so even in basements with no signal, they've got everything they need.

One plumbing company using us reduced parts-related return trips by 35%."

OBJECTION - "My guys know their stuff":
"Absolutely—experience matters. This just gives them a backup. The AI catches things like 'last time at this address we needed X' or 'this brand usually fails at Y.' It's like having the whole team's knowledge in their pocket."

OBJECTION - "We don't have time for new software":
"Totally get it. Our setup takes 15 minutes, and it's designed for techs who'd rather be under a sink than staring at a screen. Want me to send a 3-minute video so you can see how simple it is?"

CLOSE:
"Would a 15-minute demo be worth your time to see if it could help [Company Name]?"

CLOSING:
"Perfect. And just so you know, we're offering 50% off for our first 10 beta companies. Thanks, [Name]."`
  },
  {
    id: 'plumbing-voicemail',
    industry: 'plumbing',
    type: 'voicemail',
    title: 'Plumbing Voicemail Script',
    content: `"Hi [Name], this is [Your Name] with FieldTek.

We help plumbing companies reduce return trips by predicting what parts techs will need before they roll out. One of our customers cut parts-related callbacks by 35%.

The whole thing works offline too—even in basements with no signal.

I'd love to show you how it works. Give me a call at [Phone Number] or reply to my email.

Thanks, [Name]."`
  },

  // Electrical Scripts
  {
    id: 'electrical-call',
    industry: 'electrical',
    type: 'call',
    title: 'Electrical Cold Call Script',
    content: `OPENING:
"Hi [Name], this is [Your Name] with FieldTek. We help electrical contractors pass inspections the first time and avoid scope creep disputes. Do you have 2 minutes?"

IF YES:
"Great. Quick question—how does your team currently document compliance at each stage of a job?"

[Listen for pain points]

VALUE PROPOSITION:
"That's exactly what we built FieldTek for. Our AI creates timestamped checklists tied to NEC requirements and captures photos at every step. Inspectors love it, and it's saved contractors in disputes with GCs.

One electrical company told us it's the first time they've passed every inspection in a quarter."

OBJECTION - "We already document everything":
"That's great—you're ahead of most. The difference with FieldTek is the AI actively guides techs through code-compliant steps and flags scope changes in real-time, so nothing gets missed."

OBJECTION - "Inspectors are unpredictable":
"True—but when you've got timestamped photos and a complete checklist, you're in a much stronger position. Even if they find something, you've got documentation to show you followed procedure."

CLOSE:
"Would a 15-minute demo be helpful to see how this could work for [Company Name]?"

CLOSING:
"Great. And we're offering 50% off to our first 10 beta companies. I'll send over some info. Thanks, [Name]."`
  },
  {
    id: 'electrical-voicemail',
    industry: 'electrical',
    type: 'voicemail',
    title: 'Electrical Voicemail Script',
    content: `"Hi [Name], this is [Your Name] with FieldTek.

We help electrical contractors pass inspections the first time with AI-guided checklists and timestamped documentation.

One of our beta customers hasn't failed an inspection since they started using us.

I'd love to show you how it works—takes about 15 minutes.

Call me back at [Phone Number] or reply to my email.

Thanks, [Name]."`
  },

  // Mechanical Scripts
  {
    id: 'mechanical-call',
    industry: 'mechanical',
    type: 'call',
    title: 'Mechanical Cold Call Script',
    content: `OPENING:
"Hi [Name], this is [Your Name] with FieldTek. We help mechanical contractors reduce unplanned breakdowns by tracking PM schedules and equipment history in one place. Do you have 2 minutes?"

IF YES:
"Great. Quick question—how do you currently keep track of asset history across all your client sites?"

[Listen for pain points]

VALUE PROPOSITION:
"That's exactly what we're solving. FieldTek gives you complete visibility into every asset—install dates, service history, upcoming PMs—all in one place. The AI even flags recurring issues so you can propose upgrades before something fails.

One mechanical contractor told us they're now upselling preventive work because they can see the patterns."

OBJECTION - "We use spreadsheets/our current system":
"Totally understand. The difference with FieldTek is everything is connected—when a tech closes a job, the asset history updates automatically. No manual entry, no hunting through files."

OBJECTION - "Our clients don't pay for PM":
"That's actually where this helps. When you can show a client 'this unit has had 4 emergency calls in 6 months,' you've got the data to justify a PM contract or replacement. Turns reactive work into recurring revenue."

CLOSE:
"Would a 15-minute demo be helpful to see how this could work for [Company Name]?"

CLOSING:
"Perfect. We're offering 50% off for our first 10 beta companies. I'll send over some details. Thanks, [Name]."`
  },
  {
    id: 'mechanical-voicemail',
    industry: 'mechanical',
    type: 'voicemail',
    title: 'Mechanical Voicemail Script',
    content: `"Hi [Name], this is [Your Name] with FieldTek.

We help mechanical contractors track PM schedules and equipment history across all their sites—so unplanned breakdowns become a thing of the past.

Our AI even spots recurring issues so you can upsell preventive work.

I'd love to show you how it works. Call me at [Phone Number] or reply to my email.

Thanks, [Name]."`
  }
];
