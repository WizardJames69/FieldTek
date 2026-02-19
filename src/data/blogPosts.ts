export type BlogCategory = 'hvac-tips' | 'warranty-management' | 'field-service-best-practices';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: BlogCategory;
  categoryLabel: string;
  author: string;
  publishedAt: string;
  readingTime: number;
  featuredImage?: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}

export const blogCategories: { id: BlogCategory; label: string; description: string }[] = [
  {
    id: 'hvac-tips',
    label: 'HVAC Tips',
    description: 'Expert advice for HVAC technicians and contractors',
  },
  {
    id: 'warranty-management',
    label: 'Warranty Management',
    description: 'Best practices for tracking and managing equipment warranties',
  },
  {
    id: 'field-service-best-practices',
    label: 'Field Service Best Practices',
    description: 'Optimize your field service operations for maximum efficiency',
  },
];

export const blogPosts: BlogPost[] = [
  {
    id: '1',
    slug: 'hvac-maintenance-checklist-2025',
    title: 'The Complete HVAC Maintenance Checklist for 2025',
    excerpt: 'Keep your customers\' systems running efficiently with this comprehensive seasonal maintenance checklist covering all critical inspection points.',
    content: `
# The Complete HVAC Maintenance Checklist for 2025

Regular HVAC maintenance is essential for system longevity, energy efficiency, and customer satisfaction. This comprehensive checklist will help you deliver consistent, thorough service on every call.

## Spring Maintenance Checklist

### Outdoor Unit Inspection
- Clean condenser coils with approved coil cleaner
- Check refrigerant levels and inspect for leaks
- Inspect electrical connections and tighten as needed
- Verify proper airflow around the unit
- Check condenser fan motor and blades

### Indoor Unit Inspection
- Replace or clean air filters
- Clean evaporator coil if accessible
- Check drain line for clogs
- Inspect blower motor and belt condition
- Test thermostat calibration

## Fall Maintenance Checklist

### Heating System Inspection
- Inspect heat exchanger for cracks
- Test ignition system and safety controls
- Check gas valve operation
- Clean burners and adjust flame
- Verify carbon monoxide levels

### General System Checks
- Test system cycling and temperature differential
- Check ductwork for leaks
- Inspect insulation on refrigerant lines
- Document all readings for customer records

## Documentation Best Practices

Always document your findings with photos and detailed notes. Modern field service software like FieldTek makes this easy with mobile-first documentation tools that sync instantly with your office team.

## Conclusion

A thorough maintenance checklist ensures nothing gets missed and helps build trust with your customers. Implement these practices consistently across your team for the best results.
    `,
    category: 'hvac-tips',
    categoryLabel: 'HVAC Tips',
    author: 'FieldTek Team',
    publishedAt: '2025-01-15',
    readingTime: 8,
    metaTitle: 'HVAC Maintenance Checklist 2025 | Complete Seasonal Guide',
    metaDescription: 'Download our comprehensive HVAC maintenance checklist for 2025. Covers spring and fall inspections, documentation best practices, and efficiency tips.',
    keywords: ['HVAC maintenance', 'seasonal checklist', 'preventive maintenance', 'HVAC inspection'],
  },
  {
    id: '2',
    slug: 'warranty-tracking-saves-money',
    title: 'How Proper Warranty Tracking Can Save Your Customers Thousands',
    excerpt: 'Learn how implementing a systematic warranty tracking process can help your customers avoid costly out-of-pocket repairs.',
    content: `
# How Proper Warranty Tracking Can Save Your Customers Thousands

Warranty management is often overlooked in field service operations, but it represents a significant opportunity to deliver value to your customers while building loyalty.

## The Hidden Cost of Poor Warranty Tracking

Many service companies fail to track equipment warranties effectively. This leads to:

- Customers paying for repairs that should be covered
- Missed manufacturer rebates and incentives
- Unnecessary parts purchases
- Damaged customer relationships

## Building a Warranty Database

### Essential Information to Track

For every piece of equipment you service, record:

1. **Equipment Details**: Make, model, serial number
2. **Installation Date**: Critical for calculating warranty periods
3. **Warranty Duration**: Both parts and labor coverage
4. **Registration Status**: Many warranties require registration
5. **Claim History**: Previous warranty claims

### Automated Reminders

Set up automated alerts for:
- Warranties approaching expiration
- Required maintenance to maintain warranty validity
- Extended warranty opportunities

## Leveraging Technology

Modern field service management software can automatically track warranties across your entire customer base. FieldTek's equipment registry feature lets technicians:

- Scan equipment to pull warranty info instantly
- Log warranty claims directly in the field
- Alert customers before warranties expire

## Customer Communication

Proactively informing customers about their warranty status builds trust:

> "Mr. Johnson, I noticed your heat pump is still under manufacturer warranty for another 8 months. The compressor issue we found today will be covered at no cost to you."

This kind of service creates customers for life.

## Conclusion

Effective warranty tracking is a win-win: customers save money on repairs, and you build loyalty that translates to repeat business and referrals.
    `,
    category: 'warranty-management',
    categoryLabel: 'Warranty Management',
    author: 'FieldTek Team',
    publishedAt: '2025-01-10',
    readingTime: 6,
    metaTitle: 'Warranty Tracking for HVAC Companies | Save Customers Money',
    metaDescription: 'Learn how systematic warranty tracking helps HVAC contractors save customers money and build loyalty. Best practices for equipment warranty management.',
    keywords: ['warranty tracking', 'equipment warranty', 'warranty management', 'customer service'],
  },
  {
    id: '3',
    slug: 'dispatching-efficiency-tips',
    title: '7 Dispatching Strategies That Reduce Drive Time by 30%',
    excerpt: 'Optimize your dispatch operations with these proven strategies for reducing windshield time and increasing billable hours.',
    content: `
# 7 Dispatching Strategies That Reduce Drive Time by 30%

Inefficient dispatching costs field service companies thousands in wasted fuel, labor, and lost productivity. Here are seven strategies to optimize your operations.

## 1. Geographic Clustering

Group service calls by geographic area rather than time of request. This simple change can dramatically reduce drive time between jobs.

### Implementation Tips
- Divide your service area into zones
- Assign technicians to specific zones when possible
- Schedule zone-based routes the day before

## 2. Skills-Based Routing

Match technicians to jobs based on their certifications and expertise:

- **Specialists** handle complex equipment
- **Generalists** take routine maintenance
- **Apprentices** shadow experienced techs

## 3. Real-Time Traffic Integration

Use traffic data to adjust routes dynamically. A 20-minute detour to avoid a 45-minute delay is always worthwhile.

## 4. Buffer Time Between Jobs

Build in realistic travel time:

| Distance | Urban Buffer | Suburban Buffer |
|----------|--------------|-----------------|
| 0-5 miles | 15 min | 10 min |
| 5-15 miles | 30 min | 20 min |
| 15+ miles | 45 min | 35 min |

## 5. First Call Optimization

Start each technician's day close to their home when possible. This reduces:
- Morning commute to the shop
- First job arrival delays
- Fuel costs

## 6. Smart Job Sequencing

Consider job characteristics when sequencing:

- **Quick diagnostics** early in the day
- **Large installations** mid-day
- **Follow-ups** in the afternoon

## 7. Leverage Technology

Modern dispatch software provides:

- Drag-and-drop scheduling
- Route optimization algorithms
- Real-time technician tracking
- Customer ETA notifications

FieldTek's visual scheduler shows all your technicians and jobs on one screen, making optimal dispatching intuitive.

## Measuring Success

Track these KPIs monthly:
- Average drive time per job
- Jobs completed per technician per day
- Fuel costs per revenue dollar
- Customer wait time for service

## Conclusion

Implementing even a few of these strategies can yield significant improvements. Start with geographic clustering and skills-based routing for the quickest wins.
    `,
    category: 'field-service-best-practices',
    categoryLabel: 'Field Service Best Practices',
    author: 'FieldTek Team',
    publishedAt: '2025-01-05',
    readingTime: 7,
    metaTitle: 'Dispatching Strategies for Field Service | Reduce Drive Time',
    metaDescription: 'Learn 7 proven dispatching strategies that reduce technician drive time by 30%. Optimize routes, improve efficiency, and increase billable hours.',
    keywords: ['dispatching', 'route optimization', 'field service efficiency', 'technician scheduling'],
  },
  {
    id: '4',
    slug: 'refrigerant-regulations-update',
    title: 'Understanding the New Refrigerant Regulations: What HVAC Contractors Need to Know',
    excerpt: 'Stay compliant with the latest EPA refrigerant regulations. This guide covers the AIM Act, HFC phasedown, and what it means for your business.',
    content: `
# Understanding the New Refrigerant Regulations

The HVAC industry is undergoing significant changes in refrigerant regulations. Here's what contractors need to know to stay compliant and prepared.

## The AIM Act Overview

The American Innovation and Manufacturing (AIM) Act of 2020 directs the EPA to phase down the production and consumption of hydrofluorocarbons (HFCs) by 85% over the next 15 years.

### Key Milestones

- **2024**: 40% reduction from baseline
- **2029**: 70% reduction from baseline
- **2036**: 85% reduction from baseline

## Affected Refrigerants

The most commonly used refrigerants facing restrictions:

| Refrigerant | GWP | Common Applications |
|-------------|-----|---------------------|
| R-410A | 2088 | Residential AC, Heat Pumps |
| R-404A | 3922 | Commercial Refrigeration |
| R-134a | 1430 | Automotive, Chillers |

## Alternative Refrigerants

Newer low-GWP alternatives include:

### R-32
- GWP: 675 (67% lower than R-410A)
- Slightly flammable (A2L classification)
- Higher efficiency than R-410A

### R-454B
- GWP: 466
- A2L classification
- Compatible with existing designs

## What This Means for Contractors

### Training Requirements
- A2L refrigerant handling certification
- Updated safety protocols
- New equipment familiarity

### Business Implications
- Stock appropriate refrigerants
- Update service pricing
- Communicate changes to customers

## Staying Ahead

Proactive contractors are:

1. Getting certified on new refrigerants now
2. Updating their equipment registries to track refrigerant types
3. Educating customers about upgrade options

FieldTek's equipment registry helps you track exactly which refrigerants are in each system you service, making compliance reporting straightforward.

## Conclusion

While these regulations present challenges, they also create opportunities for knowledgeable contractors to differentiate themselves and add value for customers.
    `,
    category: 'hvac-tips',
    categoryLabel: 'HVAC Tips',
    author: 'FieldTek Team',
    publishedAt: '2024-12-28',
    readingTime: 6,
    metaTitle: 'New Refrigerant Regulations for HVAC | AIM Act Guide',
    metaDescription: 'Stay compliant with EPA refrigerant regulations. Learn about the AIM Act, HFC phasedown timeline, and alternative refrigerants for HVAC contractors.',
    keywords: ['refrigerant regulations', 'AIM Act', 'HFC phasedown', 'R-410A alternatives'],
  },
  {
    id: '5',
    slug: 'extended-warranty-programs',
    title: 'Building Recurring Revenue with Extended Warranty Programs',
    excerpt: 'Learn how to create and sell extended warranty programs that generate recurring revenue while providing genuine value to customers.',
    content: `
# Building Recurring Revenue with Extended Warranty Programs

Extended warranty programs represent one of the best opportunities for HVAC contractors to generate predictable recurring revenue while genuinely helping customers.

## Why Extended Warranties Work

### For Customers
- Peace of mind and budget predictability
- Priority service scheduling
- Protection against unexpected repairs

### For Contractors
- Predictable monthly revenue
- Stronger customer relationships
- Reduced seasonal revenue swings

## Structuring Your Program

### Tier Options

Consider offering multiple tiers:

**Basic Protection**
- Extended parts coverage
- Discounted labor rates
- Priority scheduling

**Premium Protection**
- All basic benefits
- Annual maintenance included
- No deductibles on repairs

**Complete Care**
- All premium benefits
- Emergency service included
- Replacement coverage for total failures

## Pricing Strategy

Calculate your pricing based on:

1. **Historical Repair Data**: What does the average system need over 5 years?
2. **Administrative Costs**: CRM, billing, tracking
3. **Profit Margin**: Typically 30-40%
4. **Competitive Analysis**: What are others charging?

### Sample Pricing Model

| Equipment Age | Basic | Premium | Complete |
|--------------|-------|---------|----------|
| 0-5 years | $15/mo | $25/mo | $40/mo |
| 6-10 years | $25/mo | $40/mo | $60/mo |
| 11+ years | $40/mo | $65/mo | Not offered |

## Technology for Management

Successful warranty programs require:

- **Accurate Equipment Tracking**: Know exactly what's covered
- **Automated Renewals**: Don't let revenue slip away
- **Claims Processing**: Efficient handling of covered repairs
- **Customer Portal**: Self-service account management

FieldTek's equipment registry and client management features are designed to support warranty programs at scale.

## Marketing Your Program

### At Point of Installation
Present warranty options before the installer leaves. Conversion rates are highest when equipment is new.

### During Service Calls
"Your compressor replacement today was $1,200. Our Premium plan would have covered this for $25/month."

### Renewal Campaigns
60 days before manufacturer warranty expires, reach out with extended coverage options.

## Conclusion

Extended warranty programs create win-win relationships with customers while building the recurring revenue that makes your business more valuable and resilient.
    `,
    category: 'warranty-management',
    categoryLabel: 'Warranty Management',
    author: 'FieldTek Team',
    publishedAt: '2024-12-20',
    readingTime: 8,
    metaTitle: 'Extended Warranty Programs for HVAC | Recurring Revenue Guide',
    metaDescription: 'Create profitable extended warranty programs for your HVAC business. Learn pricing strategies, tier structures, and marketing tactics.',
    keywords: ['extended warranty', 'recurring revenue', 'warranty programs', 'HVAC business'],
  },
  {
    id: '6',
    slug: 'technician-onboarding-best-practices',
    title: 'Technician Onboarding: Getting New Hires Productive in 30 Days',
    excerpt: 'A structured onboarding process helps new technicians become productive faster while reducing turnover. Here\'s how to build one.',
    content: `
# Technician Onboarding: Getting New Hires Productive in 30 Days

The skilled labor shortage in field service makes every new hire precious. A structured onboarding process accelerates productivity and reduces costly early turnover.

## Week 1: Foundation

### Day 1-2: Administrative & Safety
- Complete HR paperwork
- Review safety protocols and PPE requirements
- Issue tools, vehicle, and equipment
- Set up technology accounts (field service app, email)

### Day 3-5: Company Orientation
- Company history, values, and culture
- Customer service expectations
- Communication protocols
- Ride-along with senior technician (observation only)

## Week 2: Hands-On Introduction

### Supervised Service Calls
- Shadow experienced technician
- Handle simple tasks with supervision
- Practice documentation in your field service app
- Customer interaction coaching

### Technical Review
- Assess skill levels across equipment types
- Identify training gaps
- Create personalized development plan

## Week 3: Increasing Independence

### Semi-Independent Calls
- Handle routine maintenance solo
- Senior tech on standby for questions
- Review all work before leaving job site
- Daily debrief sessions

### Administrative Training
- Accurate time tracking
- Parts ordering procedures
- Invoice creation
- Customer follow-up protocols

## Week 4: Monitored Independence

### Full Service Calls
- Independent work with phone support available
- QA reviews of completed jobs
- Customer satisfaction follow-up
- End-of-week performance review

## Technology for Onboarding

Modern field service software accelerates onboarding:

### Digital Checklists
Ensure new techs never miss critical steps with built-in job checklists.

### Documentation Library
Equipment manuals and troubleshooting guides available on their mobile device.

### GPS and Job History
New techs can see previous work done at each location.

FieldTek's mobile app gives new technicians instant access to job history, equipment details, and troubleshooting resources.

## Measuring Onboarding Success

Track these metrics for new hires:

| Metric | Week 1 | Week 4 | Month 3 |
|--------|--------|--------|---------|
| Jobs per day | 0-1 | 3-4 | 5-6 |
| Callback rate | N/A | <15% | <10% |
| Customer rating | N/A | 4.0+ | 4.5+ |

## Retention Considerations

Early turnover often stems from:
- Feeling overwhelmed or unsupported
- Unclear expectations
- Inadequate tools or training
- Culture mismatch

Address these proactively during onboarding for best retention results.

## Conclusion

Investing in structured onboarding pays dividends through faster productivity, lower turnover, and more consistent service quality. Document your process and refine it with each new hire.
    `,
    category: 'field-service-best-practices',
    categoryLabel: 'Field Service Best Practices',
    author: 'FieldTek Team',
    publishedAt: '2024-12-15',
    readingTime: 9,
    metaTitle: 'Technician Onboarding Best Practices | 30-Day Guide',
    metaDescription: 'Accelerate new technician productivity with our 30-day onboarding framework. Reduce turnover and build a stronger field service team.',
    keywords: ['technician onboarding', 'new hire training', 'field service training', 'employee retention'],
  },
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find(post => post.slug === slug);
}

export function getBlogPostsByCategory(category: BlogCategory): BlogPost[] {
  return blogPosts.filter(post => post.category === category);
}

export function getRecentPosts(count: number = 3): BlogPost[] {
  return [...blogPosts]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, count);
}
