// Industry Calendar Posts (14 days - 2 weeks)
export interface CalendarPost {
  day: number;
  dayName: string;
  industry: 'hvac' | 'plumbing' | 'electrical' | 'mechanical' | 'general';
  theme: string;
  postType: 'pain-point' | 'tips' | 'feature' | 'engagement' | 'trend';
  content: string;
  bestTime: string;
}

// Feature Spotlight Posts (21 days - 3 weeks)
export interface FeaturePost {
  week: number;
  day: number;
  dayName: string;
  feature: string;
  content: string;
}

export const industryCalendar: CalendarPost[] = [
  // Week 1
  {
    day: 1,
    dayName: "Monday",
    industry: "hvac",
    theme: "Callbacks",
    postType: "pain-point",
    bestTime: "8-9 AM",
    content: `The #1 reason for HVAC callbacks isn't bad parts.

It's missing documentation.

→ No photo of the install
→ No record of the settings used
→ No proof the checklist was followed

When the customer calls back, your tech is guessing. The manufacturer says "prove it." And you eat the cost.

The fix? Make documentation as easy as a tap.

That's exactly what we built at FieldTek.

#HVAC #FieldService #Contractors`
  },
  {
    day: 2,
    dayName: "Tuesday",
    industry: "plumbing",
    theme: "Emergency calls",
    postType: "tips",
    bestTime: "7-8 AM",
    content: `3 AM emergency calls are destroying your plumbers' morale.

Here's what the best plumbing companies do differently:

1. Rotating on-call schedules (not the same guy every weekend)
2. Premium pay that actually compensates for disrupted sleep
3. Next-day follow-up so one tech doesn't carry the whole load
4. Documentation systems that capture everything at 3 AM

Your team isn't just fixing pipes. They're sacrificing sleep for your customers.

Make it worth it.

#Plumbing #FieldService #Contractors #WorkLifeBalance`
  },
  {
    day: 3,
    dayName: "Wednesday",
    industry: "electrical",
    theme: "Safety documentation",
    postType: "pain-point",
    bestTime: "8-9 AM",
    content: `That inspection failed.

Your electrician did everything right. Panel was perfect. Connections were clean.

But there's no photo documentation. No timestamped checklist. No proof of the wire gauge used.

Now you're sending someone back on YOUR dime to prove what was already done correctly.

In 2025, "trust me, I did it right" doesn't cut it anymore.

Documentation isn't paperwork. It's protection.

#Electrical #Electrician #FieldService #Contractors`
  },
  {
    day: 4,
    dayName: "Thursday",
    industry: "mechanical",
    theme: "Preventive maintenance",
    postType: "tips",
    bestTime: "8-9 AM",
    content: `The PM schedule that cut our breakdown calls by 60%:

Not more frequent visits. Smarter ones.

→ Equipment-specific checklists (not generic forms)
→ Photo comparison from last service
→ Parts wear tracking with replacement predictions
→ Service history visible on-site, not buried in the office

Your mechanics aren't just turning wrenches. They're predicting failures before they happen.

Give them the data to do it.

#Mechanical #Maintenance #FacilitiesManagement #FieldService`
  },
  {
    day: 5,
    dayName: "Friday",
    industry: "hvac",
    theme: "AI assistant",
    postType: "feature",
    bestTime: "9-10 AM",
    content: `What if every HVAC tech had a 20-year veteran in their pocket?

Someone who:
• Remembers every job at that address
• Knows the quirks of that specific model
• Can pull the service manual instantly
• Predicts which parts usually fail next

That's what AI should be for field service.

Not generic chatbots. Not theoretical "insights."

Real, practical help when your tech is staring at a unit they've never seen before.

FieldTek's AI assistant is document-grounded and history-aware. It doesn't make things up — it references YOUR service manuals and YOUR job history.

Try it: fieldtek.ai/demo-sandbox

#AI #FieldService #HVAC #TechLife`
  },
  {
    day: 6,
    dayName: "Saturday",
    industry: "plumbing",
    theme: "Parts prediction",
    postType: "feature",
    bestTime: "10-11 AM",
    content: `Your plumber's van is a rolling warehouse.

But is it stocked for THIS job?

The nightmare scenario:
→ Arrive at a water heater replacement
→ Wrong fittings
→ Trip to the supply house
→ Customer waiting 45 minutes

The fix:
→ AI that knows what's usually needed for each job type
→ Parts suggestions based on equipment at the address
→ Inventory alerts before the tech leaves the shop

FieldTek's AI assistant has seen thousands of plumbing jobs. It knows what you'll probably need.

#Plumbing #FieldService #Efficiency #Contractors`
  },
  {
    day: 7,
    dayName: "Sunday",
    industry: "electrical",
    theme: "Code compliance",
    postType: "tips",
    bestTime: "11 AM - 12 PM",
    content: `NEC 2023 changes every electrician should document:

→ GFCI requirements expanded (laundry areas now included)
→ Surge protection now required for all dwellings
→ Emergency disconnect requirements for residential
→ Updated EV charging provisions

Your techs know the code.

But when the inspector asks "where's the documentation?", what do they show?

Make compliance visible. Protect your license. Protect your crew.

#Electrical #NEC2023 #Electrician #CodeCompliance`
  },
  // Week 2
  {
    day: 8,
    dayName: "Monday",
    industry: "general",
    theme: "Technician retention",
    postType: "engagement",
    bestTime: "8-9 AM",
    content: `Honest question for service company owners:

What's the #1 thing that keeps your best technicians from leaving?

Is it:
💰 Pay
📅 Schedule flexibility  
🔧 Quality tools & equipment
📈 Career growth opportunities
👥 Team culture
📱 Technology that makes their job easier

Drop your answer below. I'll share the results next week.

#FieldService #HVAC #Plumbing #Electrical #Hiring #Retention`
  },
  {
    day: 9,
    dayName: "Tuesday",
    industry: "hvac",
    theme: "Summer prep",
    postType: "trend",
    bestTime: "7-8 AM",
    content: `Your competitors are already booking July. Are you?

The HVAC companies winning this summer:
→ Already have PM visits scheduled through June
→ Training techs on new equipment NOW
→ Pre-ordering high-demand parts before shortages hit
→ Setting up customer portal so homeowners self-schedule

The ones scrambling in August?
→ Waiting until it's "actually hot" to prepare

Summer isn't a surprise. Neither is your booking calendar.

#HVAC #SeasonalPrep #Contractors #BusinessGrowth`
  },
  {
    day: 10,
    dayName: "Wednesday",
    industry: "plumbing",
    theme: "Customer trust",
    postType: "tips",
    bestTime: "8-9 AM",
    content: `The 60-second conversation that gets 5-star plumbing reviews:

Before leaving EVERY job:

"Here's what I did today, here's what I found, and here's what I'd recommend keeping an eye on."

→ Photos of the work completed
→ Honest assessment of system condition
→ Clear next steps (even if it's "nothing for now")

Customers don't remember the repair.

They remember how you made them feel — informed, not sold to.

#Plumbing #CustomerService #Contractors #5StarReviews`
  },
  {
    day: 11,
    dayName: "Thursday",
    industry: "electrical",
    theme: "Job costing",
    postType: "pain-point",
    bestTime: "8-9 AM",
    content: `Running over on electrical jobs? The problem isn't labor.

It's scope creep without documentation.

Customer says: "While you're here, can you just..."
Your electrician says yes (because they're helpful).
End of day: 3 hours of unbilled work.

The fix:
→ Real-time job notes visible to the office
→ Change order prompts built into the workflow
→ Photo documentation of additional work requested

"Just this one thing" is eating your margins.

#Electrical #Contractors #JobCosting #FieldService`
  },
  {
    day: 12,
    dayName: "Friday",
    industry: "mechanical",
    theme: "Asset tracking",
    postType: "feature",
    bestTime: "9-10 AM",
    content: `That piece of equipment has been serviced 47 times in 8 years.

Do you know:
→ Which parts have been replaced?
→ What the last 5 service notes said?
→ Whether it's still under manufacturer warranty?
→ When it should probably be replaced entirely?

Your mechanics shouldn't have to guess.

FieldTek gives them the complete asset history before they walk in the door.

Equipment-aware intelligence. Not generic ticketing.

#Mechanical #AssetManagement #Maintenance #FacilitiesManagement`
  },
  {
    day: 13,
    dayName: "Saturday",
    industry: "hvac",
    theme: "Warranty claims",
    postType: "pain-point",
    bestTime: "10-11 AM",
    content: `Warranty claim denied.

Manufacturer says: "Prove the installation followed spec."

You're scrambling to find:
→ The original install photos (if they exist)
→ The commissioning checklist (if it was filled out)
→ Proof of refrigerant charge and airflow settings

Three hours later, you've got nothing.

That $800 compressor? It's on you now.

The fix isn't "better filing." It's capture at the source.

FieldTek requires documentation at every step. So when the manufacturer asks, you've got proof.

#HVAC #Warranty #Contractors #Documentation`
  },
  {
    day: 14,
    dayName: "Sunday",
    industry: "general",
    theme: "Industry challenge",
    postType: "engagement",
    bestTime: "11 AM - 12 PM",
    content: `I've talked to 100+ field service owners this year.

One question always sparks the most conversation:

"What's the hardest part of running a service company in 2025?"

The answers range from:
→ Finding qualified techs
→ Customer expectations
→ Cash flow timing
→ Technology overwhelm
→ Competition from big players

What's yours?

(No sales pitch here — genuinely curious what's on your mind.)

#FieldService #HVAC #Plumbing #Electrical #Contractors #SmallBusiness`
  }
];

export const featureSpotlights: FeaturePost[] = [
  // Week 1
  {
    week: 1,
    day: 1,
    dayName: "Monday",
    feature: "AI Field Assistant",
    content: `Your tech is staring at a unit they've never seen before.

Old way: Call the office. Wait on hold. Hope someone knows.

New way: Ask the AI.

FieldTek's AI Field Assistant:
→ Trained on manufacturer manuals
→ Knows YOUR service history at that address
→ Suggests troubleshooting steps based on symptoms
→ Cites sources (no hallucinations)

It's like having a 20-year veteran in every tech's pocket.

Try it free: fieldtek.ai/demo-sandbox

#AI #FieldService #HVAC #Plumbing #Electrical`
  },
  {
    week: 1,
    day: 2,
    dayName: "Tuesday",
    feature: "Document-Grounded AI",
    content: `Most AI makes things up.

Ours doesn't.

FieldTek's AI is document-grounded. That means:
✅ Cites YOUR uploaded service manuals
✅ References actual manufacturer specifications
✅ Shows you the source of every answer
✅ Admits when it doesn't know something

"The compressor specs say..." is very different from "I think the compressor..."

Your techs need facts, not guesses.

#AI #FieldService #Contractors #TechLife`
  },
  {
    week: 1,
    day: 3,
    dayName: "Wednesday",
    feature: "Service History Intelligence",
    content: `47 jobs at this address.

What patterns does the data reveal?

FieldTek's service history intelligence shows:
→ Recurring issues at this location
→ Parts replaced over time
→ Previous technician notes
→ Equipment performance trends

Before your tech walks in, they already know:
• What's been tried before
• What worked (and what didn't)
• What the customer complained about last time

Context is everything.

#FieldService #AI #CustomerService #Contractors`
  },
  {
    week: 1,
    day: 4,
    dayName: "Thursday",
    feature: "Parts Prediction",
    content: `Stop running to the supply house twice a day.

FieldTek's parts prediction:
→ Analyzes the job type
→ Looks at equipment age and history
→ Checks what similar jobs required
→ Suggests parts BEFORE you leave the shop

Your tech shows up with:
✅ The right parts
✅ The right quantities
✅ Backup parts for likely issues

First-time fix rates go up. Windshield time goes down.

#FieldService #Efficiency #PartsManagement #Contractors`
  },
  {
    week: 1,
    day: 5,
    dayName: "Friday",
    feature: "Warranty Tracking",
    content: `Warranty expiring in 14 days.

Did your tech know?

FieldTek tracks warranty status on every piece of equipment:
→ Manufacturer warranty start and end dates
→ Extended warranty information
→ Automatic alerts before expiration
→ Visible on-site during every job

Turn expiring warranties into service agreements.

Turn service agreements into recurring revenue.

#Warranty #FieldService #HVAC #Revenue`
  },
  {
    week: 1,
    day: 6,
    dayName: "Saturday",
    feature: "Drag-and-Drop Scheduling",
    content: `Dispatch used to take 2 hours every morning.

Now it takes 15 minutes.

FieldTek's scheduling view:
📅 Weekly calendar with drag-and-drop
👷 Technician workload at a glance
🚗 Travel optimization
⚡ Urgent jobs flagged automatically
📊 Capacity planning for the week ahead

Stop playing Tetris with your technicians' time.

Start running dispatch like a pro.

#Dispatching #FieldService #Scheduling #Efficiency`
  },
  {
    week: 1,
    day: 7,
    dayName: "Sunday",
    feature: "Mobile-First Design",
    content: `Your techs don't work at desks.

Why does your software act like they do?

FieldTek mobile was built for the field:
📱 Works offline (syncs when back online)
📸 Photo capture with one tap
✅ Checklists that can't be skipped
🎯 Status updates without typing

Built for gloves, not keyboards.
Built for basements, not boardrooms.
Built for techs, not admins.

Try it: fieldtek.ai/demo-sandbox

#FieldService #MobileApp #Contractors`
  },
  // Week 2
  {
    week: 2,
    day: 1,
    dayName: "Monday",
    feature: "Offline Mode",
    content: `No signal in the basement?
No signal in the mechanical room?
No signal in rural areas?

No problem.

FieldTek works offline:
→ View all job details
→ Complete checklists
→ Capture photos
→ Update status
→ Add notes

Everything syncs automatically when you're back online.

Your software should work where your techs work.

#FieldService #MobileApp #Contractors #Offline`
  },
  {
    week: 2,
    day: 2,
    dayName: "Tuesday",
    feature: "Photo Documentation",
    content: `Before/after photos. Every job. Automatic proof.

Why it matters:
→ Warranty claims get approved
→ Customer disputes disappear
→ Quality issues surface faster
→ Training becomes visual

FieldTek makes photo capture part of the workflow:
📸 Required photos at key checklist steps
📁 Automatic organization by job
🔍 Searchable by customer, equipment, or date

"Trust me, I did it right" → "Here's the proof."

#Documentation #FieldService #Quality #Contractors`
  },
  {
    week: 2,
    day: 3,
    dayName: "Wednesday",
    feature: "Job Checklists",
    content: `The checklist that eliminates callbacks:

Not optional. Not skippable. Part of the job.

FieldTek checklists:
✅ Customizable per job type
✅ Required photos at key steps
✅ Technician sign-off on completion
✅ Automatic timestamp and location

Your best technician's process — now everyone's process.

Callbacks cost $150-300+ each.

Good checklists cost nothing.

#QualityControl #FieldService #Callbacks #Contractors`
  },
  {
    week: 2,
    day: 4,
    dayName: "Thursday",
    feature: "Customer Portal",
    content: `Your customers want to:
→ Submit service requests at midnight
→ Check job status without calling
→ View their equipment history
→ Pay invoices online

You want to:
→ Not answer the same questions 50 times a day
→ Collect payments faster
→ Reduce admin work

The customer portal gives everyone what they want.

Included free with every FieldTek plan.

#CustomerService #FieldService #Automation`
  },
  {
    week: 2,
    day: 5,
    dayName: "Friday",
    feature: "Service Request Intake",
    content: `Customers submit requests at 2 AM.

Your office handles them at 8.

FieldTek's service request system:
→ Branded portal for your customers
→ Photo and video upload support
→ Equipment selection from their history
→ Priority flagging for emergencies
→ Automatic confirmation emails

No voicemails to transcribe.
No phone tag to play.
No details lost in translation.

#CustomerService #FieldService #Automation #Efficiency`
  },
  {
    week: 2,
    day: 6,
    dayName: "Saturday",
    feature: "AI Request Triage",
    content: `New service request just came in.

AI reads it and suggests:
→ Priority level (emergency vs. routine)
→ Job type classification
→ Recommended technician based on skills
→ Estimated duration
→ Related equipment from customer history

Your dispatcher reviews and approves.

30 seconds instead of 5 minutes — per request.

#AI #FieldService #Dispatching #Automation`
  },
  {
    week: 2,
    day: 7,
    dayName: "Sunday",
    feature: "Equipment Tracking",
    content: `Know what's installed BEFORE you arrive.

FieldTek's equipment registry:
→ Full inventory per customer location
→ Make, model, serial number
→ Install date and warranty status
→ Complete service history
→ Photo documentation

Your tech walks in knowing:
• What equipment exists
• What's been done before
• What's likely to need attention

No more "what unit are we working on today?"

#EquipmentManagement #FieldService #Contractors`
  },
  // Week 3
  {
    week: 3,
    day: 1,
    dayName: "Monday",
    feature: "Invoice Generation",
    content: `Job complete.

Old way: Write it down → Drive back → Enter in system → Create invoice → Email it → Wait

New way: One tap.

FieldTek auto-populates invoices with:
→ Parts used
→ Labor time
→ Job details
→ Customer info

Invoice sent before your tech leaves the driveway.

Get paid faster. Do less paperwork.

#Invoicing #FieldService #Contractors #Automation`
  },
  {
    week: 3,
    day: 2,
    dayName: "Tuesday",
    feature: "Payment Collection",
    content: `Get paid same-day. Not net-60.

FieldTek's payment collection:
→ Accept credit cards on-site
→ Send payment links via email/text
→ Customer portal for invoice payment
→ Automatic payment reminders
→ Real-time payment status

The average contractor waits 30+ days for payment.

Our users? Often same-day.

Cash flow is oxygen. Stop holding your breath.

#Payments #FieldService #CashFlow #Contractors`
  },
  {
    week: 3,
    day: 3,
    dayName: "Wednesday",
    feature: "Real-Time Notifications",
    content: `Job status changed.

Everyone who needs to know... knows.

FieldTek notifications:
→ Job assigned → Tech notified
→ Tech en route → Customer notified
→ Job complete → Office notified
→ Invoice paid → Everyone celebrates

No more "Did they get there yet?"
No more "Is that job done?"
No more status calls.

Real-time visibility for everyone.

#Communication #FieldService #Notifications #Transparency`
  },
  {
    week: 3,
    day: 4,
    dayName: "Thursday",
    feature: "Global Search",
    content: `Press ⌘K (or Ctrl+K).

Find anything in 2 seconds:
→ Customer by name or address
→ Job by title or status
→ Equipment by serial number
→ Invoice by amount
→ Technician by name

No more clicking through 5 menus to find that one job from last month.

Power users love this.

#Productivity #FieldService #Software #UX`
  },
  {
    week: 3,
    day: 5,
    dayName: "Friday",
    feature: "Bulk Operations",
    content: `Update 50 jobs at once.

Not one by one.

FieldTek bulk operations:
→ Reschedule multiple jobs
→ Reassign to different technician
→ Update job status in batch
→ Send bulk notifications
→ Export to CSV

End-of-day job cleanup? 30 seconds, not 30 minutes.

#Efficiency #FieldService #BulkActions #TimeManagement`
  },
  {
    week: 3,
    day: 6,
    dayName: "Saturday",
    feature: "CSV Import",
    content: `Bring your existing data. We'll map it.

FieldTek CSV import:
→ Customers
→ Equipment
→ Job history
→ Parts catalog

Upload your spreadsheet. Map the columns. Done.

No manual data entry.
No lost history.
No starting from scratch.

Your data is your data. We just make it useful.

#DataMigration #FieldService #Software #Implementation`
  },
  {
    week: 3,
    day: 7,
    dayName: "Sunday",
    feature: "15-Minute Setup",
    content: `"We'll need 3 months for implementation."
"Training takes 2 weeks."
"You'll need a consultant."

We disagree.

FieldTek setup:
→ Create account
→ Import your data (or start fresh)
→ Invite your team
→ You're live

15 minutes. No consultants. No training sessions.

Enterprise features without enterprise complexity.

Try the demo: fieldtek.ai/demo-sandbox

#FSM #FieldService #Software #Contractors`
  }
];

export const industryConfig = {
  hvac: { label: "HVAC", color: "bg-orange-500/10 text-orange-600 border-orange-500/30", icon: "Flame" },
  plumbing: { label: "Plumbing", color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: "Droplet" },
  electrical: { label: "Electrical", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30", icon: "Zap" },
  mechanical: { label: "Mechanical", color: "bg-slate-500/10 text-slate-600 border-slate-500/30", icon: "Wrench" },
  general: { label: "General", color: "bg-purple-500/10 text-purple-600 border-purple-500/30", icon: "Users" }
} as const;

export const postTypeConfig = {
  "pain-point": { label: "Pain Point", color: "bg-red-500/10 text-red-600" },
  "tips": { label: "Tips", color: "bg-green-500/10 text-green-600" },
  "feature": { label: "Feature", color: "bg-primary/10 text-primary" },
  "engagement": { label: "Engagement", color: "bg-purple-500/10 text-purple-600" },
  "trend": { label: "Trend", color: "bg-cyan-500/10 text-cyan-600" }
} as const;
