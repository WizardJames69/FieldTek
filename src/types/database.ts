// Database Types for FieldTek Multi-Tenant SaaS

export type AppRole = 'owner' | 'admin' | 'dispatcher' | 'technician' | 'client';
export type SubscriptionTier = 'trial' | 'starter' | 'growth' | 'professional' | 'enterprise';
export type SubscriptionStatus = 'trial' | 'active' | 'cancelled' | 'past_due';
export type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type JobPriority = 'low' | 'medium' | 'high' | 'urgent';
export type IndustryType = 'hvac' | 'plumbing' | 'electrical' | 'mechanical' | 'elevator' | 'home_automation' | 'general';
export type RequestStatus = 'new' | 'reviewed' | 'approved' | 'rejected' | 'converted';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  industry: IndustryType;
  owner_id: string | null;
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantBranding {
  id: string;
  tenant_id: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  company_name: string | null;
  favicon_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: AppRole;
  is_active: boolean;
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string;
  created_at: string;
}

export interface TenantSettings {
  id: string;
  tenant_id: string;
  equipment_types: string[];
  job_types: string[];
  document_categories: string[];
  workflow_stages: string[];
  features_enabled: {
    ai_assistant: boolean;
    invoicing: boolean;
    equipment_tracking: boolean;
  };
  tax_rate: number;
  currency: string;
  timezone: string;
  country: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  certifications: string[];
  skills: string[];
  notification_preferences: {
    email: boolean;
    push: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Equipment {
  id: string;
  tenant_id: string;
  client_id: string | null;
  equipment_type: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  install_date: string | null;
  warranty_expiry: string | null;
  location_notes: string | null;
  status: string;
  specifications: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ScheduledJob {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  client_id: string | null;
  equipment_id: string | null;
  assigned_to: string | null;
  status: JobStatus;
  priority: JobPriority;
  job_type: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_duration: number;
  actual_start: string | null;
  actual_end: string | null;
  address: string | null;
  current_stage: string | null;
  stage_data: Record<string, unknown>;
  notes: string | null;
  internal_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  client?: Client;
  assigned_user?: Profile;
}

export interface ServiceRequest {
  id: string;
  tenant_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  request_type: string | null;
  priority: JobPriority;
  status: RequestStatus;
  photos: string[];
  ai_analysis: Record<string, unknown> | null;
  converted_job_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  client_id: string | null;
  job_id: string | null;
  status: InvoiceStatus;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  due_date: string | null;
  paid_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  line_items?: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  item_type: string;
  created_at: string;
}

export interface Document {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: string | null;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  equipment_types: string[];
  uploaded_by: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  context_type: string | null;
  context_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Industry Presets
export const INDUSTRY_PRESETS: Record<IndustryType, {
  equipment_types: string[];
  job_types: string[];
  workflow_stages: string[];
  document_categories: string[];
}> = {
  hvac: {
    equipment_types: ['Air Conditioner', 'Heat Pump', 'Furnace', 'Boiler', 'RTU', 'Mini-Split', 'Chiller', 'Cooling Tower', 'Air Handler', 'Thermostat'],
    job_types: ['Installation', 'Service', 'Maintenance', 'Warranty', 'Inspection', 'Startup', 'Emergency'],
    workflow_stages: ['Diagnosis', 'Service', 'Maintenance', 'Inspection', 'Testing'],
    document_categories: ['Installation Manuals', 'Service Guides', 'Wiring Diagrams', 'Parts Lists', 'Safety Sheets'],
  },
  plumbing: {
    equipment_types: ['Water Heater', 'Sump Pump', 'Well Pump', 'Tankless Heater', 'Water Softener', 'Sewage Ejector', 'Garbage Disposal', 'Water Filter'],
    job_types: ['Installation', 'Repair', 'Drain Cleaning', 'Inspection', 'Emergency', 'Maintenance', 'Replacement'],
    workflow_stages: ['Diagnosis', 'Repair', 'Inspection', 'Testing', 'Cleanup'],
    document_categories: ['Installation Guides', 'Code References', 'Product Manuals', 'Safety Procedures'],
  },
  electrical: {
    equipment_types: ['Panel', 'Generator', 'EV Charger', 'Transformer', 'Motor', 'VFD', 'Lighting System', 'Surge Protector', 'UPS'],
    job_types: ['Installation', 'Troubleshooting', 'Inspection', 'Upgrade', 'Emergency', 'Maintenance', 'Code Compliance'],
    workflow_stages: ['Assessment', 'Installation', 'Testing', 'Inspection', 'Certification'],
    document_categories: ['Wiring Diagrams', 'Code Books', 'Safety Manuals', 'Equipment Specs', 'Permits'],
  },
  mechanical: {
    equipment_types: ['Compressor', 'Pump', 'Motor', 'Conveyor', 'HVAC System', 'Refrigeration Unit', 'Hydraulic System', 'Pneumatic System'],
    job_types: ['Installation', 'Preventive Maintenance', 'Breakdown Repair', 'Inspection', 'Overhaul', 'Calibration'],
    workflow_stages: ['Diagnosis', 'Repair', 'Testing', 'Commissioning', 'Documentation'],
    document_categories: ['Service Manuals', 'Parts Catalogs', 'Maintenance Schedules', 'Technical Bulletins'],
  },
  elevator: {
    equipment_types: ['Traction Elevator', 'Hydraulic Elevator', 'MRL Elevator', 'Escalator', 'Dumbwaiter', 'Freight Elevator', 'Platform Lift', 'Door Operator', 'Controller', 'Governor'],
    job_types: ['Inspection', 'Preventive Maintenance', 'Callback', 'Modernization', 'Installation', 'Emergency', 'Code Compliance'],
    workflow_stages: ['Inspection', 'Diagnosis', 'Repair', 'Testing', 'Certification'],
    document_categories: ['Inspection Reports', 'Code Compliance', 'Maintenance Logs', 'Wiring Diagrams', 'Safety Certificates'],
  },
  home_automation: {
    equipment_types: ['Smart Thermostat', 'Security Camera', 'Smart Lock', 'Lighting Controller', 'Home Hub', 'Audio System', 'Motorized Shade', 'Network Switch', 'Access Point', 'Video Doorbell'],
    job_types: ['Installation', 'Programming', 'Troubleshooting', 'Network Setup', 'System Integration', 'Maintenance', 'Consultation'],
    workflow_stages: ['Site Survey', 'Installation', 'Programming', 'Testing', 'Client Training'],
    document_categories: ['System Diagrams', 'Network Maps', 'Device Manuals', 'Programming Guides', 'Client Handoffs'],
  },
  general: {
    equipment_types: ['Equipment 1', 'Equipment 2', 'Equipment 3'],
    job_types: ['Service', 'Installation', 'Repair', 'Maintenance', 'Inspection'],
    workflow_stages: ['Start', 'In Progress', 'Review', 'Complete'],
    document_categories: ['Manuals', 'Guides', 'Forms', 'References'],
  },
};
