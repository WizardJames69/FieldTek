// Demo Tour Configuration with Industry-Specific Support
import { IndustryType, INDUSTRY_TERMINOLOGY, TerminologyKey } from '@/config/industryTerminology';

export interface TourStep {
  id: string;
  target: string;
  title: string | ((industry: IndustryType) => string);
  description: string | ((industry: IndustryType) => string);
  position: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  page: string;
  action?: 'click' | 'highlight' | 'interactive';
  interactiveHint?: string;
  nextDelay?: number;
  category?: 'core' | 'advanced' | 'power-user';
}

// Helper to get terminology
const t = (industry: IndustryType, key: TerminologyKey) => {
  return INDUSTRY_TERMINOLOGY[industry]?.[key] || INDUSTRY_TERMINOLOGY.general[key];
};

// Comprehensive tour steps with industry awareness
export const DEMO_TOUR_STEPS: TourStep[] = [
  // === CORE STEPS (Original 13) ===
  
  // Dashboard Tour
  {
    id: 'welcome',
    target: '[data-tour="dashboard-header"]',
    title: 'Welcome to FieldTek! 👋',
    description: (industry) => `Let's take a quick tour of the platform. This dashboard gives you a complete overview of your ${t(industry, 'jobs').toLowerCase()} and team operations.`,
    position: 'bottom',
    page: '/demo/dashboard',
    category: 'core',
  },
  {
    id: 'dashboard-stats',
    target: '[data-tour="dashboard-stats"]',
    title: 'Real-Time Metrics',
    description: (industry) => `Track ${t(industry, 'jobs').toLowerCase()} completed, revenue generated, and ${t(industry, 'technicians').toLowerCase()} performance at a glance.`,
    position: 'bottom',
    page: '/demo/dashboard',
    category: 'core',
  },
  {
    id: 'dashboard-jobs-today',
    target: '[data-tour="jobs-today"]',
    title: (industry) => `Today's ${t(industry, 'jobs')}`,
    description: (industry) => `See all ${t(industry, 'jobs').toLowerCase()} scheduled for today with status, assigned ${t(industry, 'technician').toLowerCase()}, and priority level.`,
    position: 'bottom',
    page: '/demo/dashboard',
    category: 'core',
  },
  
  // Schedule Tour
  {
    id: 'schedule-intro',
    target: '[data-tour="schedule-grid"]',
    title: 'Drag & Drop Scheduling',
    description: (industry) => `This is your visual scheduling board. See all ${t(industry, 'technicians').toLowerCase()} and their ${t(industry, 'jobs').toLowerCase()} at a glance. Drag to reschedule.`,
    position: 'bottom',
    page: '/demo/schedule',
    category: 'core',
  },
  {
    id: 'schedule-technicians',
    target: '[data-tour="technician-list"]',
    title: (industry) => `Your ${t(industry, 'technicians')}`,
    description: (industry) => `Each row shows a ${t(industry, 'technician').toLowerCase()}'s schedule for the week. See workload and availability at a glance.`,
    position: 'bottom',
    page: '/demo/schedule',
    category: 'core',
  },
  
  // Jobs Tour
  {
    id: 'jobs-list',
    target: '[data-tour="jobs-list"]',
    title: (industry) => `${t(industry, 'job')} Management`,
    description: (industry) => `View all ${t(industry, 'jobs').toLowerCase()} with status, priority, and assignment. Click any ${t(industry, 'job').toLowerCase()} to see full details.`,
    position: 'auto',
    page: '/demo/jobs',
    category: 'core',
  },
  {
    id: 'jobs-filters',
    target: '[data-tour="jobs-filters"]',
    title: 'Smart Filters',
    description: (industry) => `Filter ${t(industry, 'jobs').toLowerCase()} by status, priority, date range, or ${t(industry, 'technician').toLowerCase()}. Find exactly what you need.`,
    position: 'left',
    page: '/demo/jobs',
    category: 'core',
  },
  
  // Clients Tour
  {
    id: 'clients-list',
    target: '[data-tour="clients-list"]',
    title: (industry) => `${t(industry, 'client')} Database`,
    description: (industry) => `Manage all your ${t(industry, 'clients').toLowerCase()} in one place. See their ${t(industry, 'equipment').toLowerCase()}, service history, and contact information.`,
    position: 'bottom',
    page: '/demo/clients',
    category: 'core',
  },
  
  // Equipment Tour
  {
    id: 'equipment-list',
    target: '[data-tour="equipment-list"]',
    title: (industry) => `${t(industry, 'equipment')} Tracking`,
    description: (industry) => `Track all ${t(industry, 'client').toLowerCase()} ${t(industry, 'equipment').toLowerCase()} with warranty dates, service history, and technical specifications.`,
    position: 'bottom',
    page: '/demo/equipment',
    category: 'core',
  },
  
  // Invoices Tour
  {
    id: 'invoices-list',
    target: '[data-tour="invoices-list"]',
    title: 'Invoice Management',
    description: 'Create, send, and track invoices. See payment status and aging reports all in one place.',
    position: 'bottom',
    page: '/demo/invoices',
    category: 'core',
  },
  
  // AI Assistant Tour
  {
    id: 'ai-assistant',
    target: '[data-tour="ai-chat"]',
    title: 'AI Field Assistant',
    description: (industry) => `Your ${t(industry, 'technicians').toLowerCase()} can ask questions about procedures, troubleshooting, and ${t(industry, 'equipment').toLowerCase()} specs. Get instant answers in the field.`,
    position: 'top',
    page: '/demo/assistant',
    category: 'core',
  },
  
  // Service Requests Tour
  {
    id: 'service-requests-list',
    target: '[data-tour="service-requests-list"]',
    title: 'Service Requests',
    description: (industry) => `${t(industry, 'clients')} can submit service requests through your portal. AI automatically suggests priority and ${t(industry, 'job').toLowerCase()} type.`,
    position: 'bottom',
    page: '/demo/requests',
    category: 'core',
  },

  // === NEW ADVANCED STEPS (8 Additional) ===
  
  // Bulk Actions
  {
    id: 'bulk-actions',
    target: '[data-tour="bulk-actions"]',
    title: 'Bulk Operations',
    description: (industry) => `Select multiple ${t(industry, 'jobs').toLowerCase()} to update status, assign ${t(industry, 'technicians').toLowerCase()}, or export data in one click.`,
    position: 'bottom',
    page: '/demo/jobs',
    action: 'interactive',
    interactiveHint: 'Try selecting multiple jobs using the checkboxes',
    category: 'advanced',
  },
  
  // Quick Actions on Mobile Cards
  {
    id: 'quick-actions',
    target: '[data-tour="job-quick-actions"]',
    title: 'Quick Status Updates',
    description: (industry) => `Update ${t(industry, 'job').toLowerCase()} status with a single tap. Perfect for ${t(industry, 'technicians').toLowerCase()} in the field.`,
    position: 'bottom',
    page: '/demo/jobs',
    category: 'advanced',
  },
  
  // CSV Import
  {
    id: 'csv-import',
    target: '[data-tour="import-button"]',
    title: 'Import Your Data',
    description: (industry) => `Easily import ${t(industry, 'clients').toLowerCase()}, ${t(industry, 'equipment').toLowerCase()}, or ${t(industry, 'jobs').toLowerCase()} from CSV files. Map columns to match your data.`,
    position: 'bottom',
    page: '/demo/clients',
    category: 'advanced',
  },
  
  // Client Equipment History
  {
    id: 'client-equipment-history',
    target: '[data-tour="clients-list"]',
    title: (industry) => `${t(industry, 'equipment')} History`,
    description: (industry) => `Click any ${t(industry, 'client').toLowerCase()} card to view their ${t(industry, 'equipment').toLowerCase()} history, warranties, and maintenance schedules.`,
    position: 'bottom',
    page: '/demo/clients',
    category: 'advanced',
  },
  
  // Invoice Creation from Job
  {
    id: 'invoice-from-job',
    target: '[data-tour="create-invoice"]',
    title: 'One-Click Invoicing',
    description: (industry) => `Generate invoices directly from completed ${t(industry, 'jobs').toLowerCase()}. Parts and labor are automatically populated.`,
    position: 'bottom',
    page: '/demo/invoices',
    action: 'interactive',
    interactiveHint: 'Click "+ New Invoice" to see the creation flow',
    category: 'advanced',
  },
  
  // Notification Bell
  {
    id: 'notifications',
    target: '[data-tour="notification-bell"]',
    title: 'Real-Time Notifications',
    description: (industry) => `Get instant alerts for new service requests, ${t(industry, 'job').toLowerCase()} updates, and payment confirmations.`,
    position: 'bottom',
    page: '/demo/dashboard',
    category: 'advanced',
  },
  
  // Global Search
  {
    id: 'global-search',
    target: '[data-tour="global-search"]',
    title: 'Search Everything',
    description: (industry) => `Quickly find ${t(industry, 'clients').toLowerCase()}, ${t(industry, 'jobs').toLowerCase()}, ${t(industry, 'equipment').toLowerCase()}, or invoices. Press ⌘K to search from anywhere.`,
    position: 'bottom',
    page: '/demo/dashboard',
    category: 'power-user',
  },
  
  // Final
  {
    id: 'tour-complete',
    target: '[data-tour="checklist"]',
    title: 'You\'re All Set! 🎉',
    description: 'That\'s the tour! Continue exploring features using this checklist, or join our waitlist for early access.',
    position: 'bottom',
    page: '/demo/dashboard',
    category: 'core',
  },
];

// Extended feature checklist with new items
export interface ChecklistItem {
  id: string;
  label: string;
  labelFn?: (industry: IndustryType) => string;
  description: string;
  descriptionFn?: (industry: IndustryType) => string;
  path: string;
  icon: string;
  category: 'core' | 'advanced';
}

export const DEMO_FEATURES_CHECKLIST_EXTENDED: ChecklistItem[] = [
  {
    id: 'view-dashboard',
    label: 'View the Dashboard',
    description: 'See key metrics and today\'s schedule at a glance',
    descriptionFn: (industry) => `See key metrics and today's ${t(industry, 'jobs').toLowerCase()} at a glance`,
    path: '/dashboard',
    icon: 'LayoutDashboard',
    category: 'core',
  },
  {
    id: 'explore-schedule',
    label: 'Explore the Schedule',
    description: 'View the drag-and-drop scheduling calendar',
    path: '/schedule',
    icon: 'Calendar',
    category: 'core',
  },
  {
    id: 'view-job-details',
    label: 'Open a Job',
    labelFn: (industry) => `Open a ${t(industry, 'job')}`,
    description: 'Click on any job to see full details and workflow',
    descriptionFn: (industry) => `Click on any ${t(industry, 'job').toLowerCase()} to see full details and workflow`,
    path: '/jobs',
    icon: 'Briefcase',
    category: 'core',
  },
  {
    id: 'check-invoices',
    label: 'Review Invoices',
    description: 'See how invoicing and payments work',
    path: '/invoices',
    icon: 'FileText',
    category: 'core',
  },
  {
    id: 'try-ai-assistant',
    label: 'Try the AI Assistant',
    description: 'Ask a question about procedures',
    descriptionFn: (industry) => `Ask a question about ${industry === 'hvac' ? 'HVAC' : industry === 'plumbing' ? 'plumbing' : industry === 'electrical' ? 'electrical' : 'service'} procedures`,
    path: '/assistant',
    icon: 'Bot',
    category: 'core',
  },
  {
    id: 'view-clients',
    label: 'Browse Clients',
    labelFn: (industry) => `Browse ${t(industry, 'clients')}`,
    description: 'See customer profiles and history',
    descriptionFn: (industry) => `See ${t(industry, 'client').toLowerCase()} profiles and history`,
    path: '/clients',
    icon: 'Users',
    category: 'core',
  },
  {
    id: 'explore-equipment',
    label: 'View Equipment',
    labelFn: (industry) => `View ${t(industry, 'equipment')}`,
    description: 'Track customer equipment and warranties',
    descriptionFn: (industry) => `Track ${t(industry, 'client').toLowerCase()} ${t(industry, 'equipment').toLowerCase()} and warranties`,
    path: '/equipment',
    icon: 'Wrench',
    category: 'core',
  },
  {
    id: 'check-service-requests',
    label: 'Service Requests',
    description: 'See how customers submit service requests',
    descriptionFn: (industry) => `See how ${t(industry, 'clients').toLowerCase()} submit service requests`,
    path: '/requests',
    icon: 'Inbox',
    category: 'core',
  },
  // New advanced items
  {
    id: 'try-bulk-actions',
    label: 'Try Bulk Actions',
    description: 'Select multiple items to update at once',
    descriptionFn: (industry) => `Select multiple ${t(industry, 'jobs').toLowerCase()} to update at once`,
    path: '/jobs',
    icon: 'CheckSquare',
    category: 'advanced',
  },
  {
    id: 'use-global-search',
    label: 'Use Global Search',
    description: 'Press ⌘K to search across all data',
    path: '/dashboard',
    icon: 'Search',
    category: 'advanced',
  },
];

// Get resolved step content based on industry
export function getResolvedTourStep(step: TourStep, industry: IndustryType): {
  id: string;
  target: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  page: string;
  action?: 'click' | 'highlight' | 'interactive';
  interactiveHint?: string;
} {
  return {
    id: step.id,
    target: step.target,
    title: typeof step.title === 'function' ? step.title(industry) : step.title,
    description: typeof step.description === 'function' ? step.description(industry) : step.description,
    position: step.position,
    page: step.page,
    action: step.action,
    interactiveHint: step.interactiveHint,
  };
}

// Get checklist item with industry-specific text
export function getResolvedChecklistItem(
  item: ChecklistItem,
  industry: IndustryType
): {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: string;
  category: string;
} {
  return {
    id: item.id,
    label: item.labelFn ? item.labelFn(industry) : item.label,
    description: item.descriptionFn ? item.descriptionFn(industry) : item.description,
    path: item.path,
    icon: item.icon,
    category: item.category,
  };
}

// Get tour steps for a specific category
export function getTourStepsByCategory(category: 'core' | 'advanced' | 'power-user' | 'all' = 'all'): TourStep[] {
  if (category === 'all') return DEMO_TOUR_STEPS;
  return DEMO_TOUR_STEPS.filter(step => step.category === category);
}

// Get total tour step count
export function getTourStepCount(): number {
  return DEMO_TOUR_STEPS.length;
}
