// CSV Parsing and Validation Utilities

export const CSV_LIMITS = {
  MAX_ROWS: 1000,
  MAX_FIELD_LENGTH: 1000,
  MAX_COLUMNS: 50,
};

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

export interface ColumnMapping {
  csvColumn: string;
  targetField: string;
  required: boolean;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

// Parse CSV content into structured data
export function parseCSV(content: string): ParsedCSV {
  const errors: string[] = [];
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    return { headers: [], rows: [], errors: ['CSV file is empty'] };
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  
  if (headers.length === 0) {
    return { headers: [], rows: [], errors: ['No valid headers found'] };
  }

  // Enforce column limit
  if (headers.length > CSV_LIMITS.MAX_COLUMNS) {
    return { headers: [], rows: [], errors: [`Too many columns (${headers.length}). Maximum is ${CSV_LIMITS.MAX_COLUMNS}.`] };
  }

  // Parse data rows
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Enforce row limit
    if (rows.length >= CSV_LIMITS.MAX_ROWS) {
      errors.push(`File exceeds maximum of ${CSV_LIMITS.MAX_ROWS} rows. Only the first ${CSV_LIMITS.MAX_ROWS} rows were imported.`);
      break;
    }
    
    const values = parseCSVLine(line);
    
    if (values.length !== headers.length) {
      errors.push(`Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}`);
      continue;
    }
    
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      // Truncate field values that exceed the limit
      const val = values[index] || '';
      row[header] = val.length > CSV_LIMITS.MAX_FIELD_LENGTH
        ? val.substring(0, CSV_LIMITS.MAX_FIELD_LENGTH)
        : val;
    });
    rows.push(row);
  }

  return { headers, rows, errors };
}

// Parse a single CSV line, handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  
  result.push(current.trim());
  return result;
}

// Normalize column names for matching
export function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// Auto-detect column mappings based on header names
export function autoDetectMappings(
  headers: string[],
  targetFields: Array<{ field: string; aliases: string[] }>
): Record<string, string> {
  const mappings: Record<string, string> = {};
  
  for (const header of headers) {
    const normalized = normalizeColumnName(header);
    
    for (const target of targetFields) {
      const allNames = [target.field, ...target.aliases].map(normalizeColumnName);
      
      if (allNames.includes(normalized)) {
        mappings[header] = target.field;
        break;
      }
    }
  }
  
  return mappings;
}

// Client field definitions for auto-mapping
export const CLIENT_FIELDS = [
  { field: 'name', aliases: ['client_name', 'customer_name', 'customer', 'client', 'company', 'business_name'], required: true },
  { field: 'email', aliases: ['email_address', 'e_mail', 'contact_email'], required: false },
  { field: 'phone', aliases: ['phone_number', 'telephone', 'tel', 'mobile', 'contact_phone'], required: false },
  { field: 'address', aliases: ['street_address', 'street', 'address_line_1'], required: false },
  { field: 'city', aliases: ['town', 'municipality'], required: false },
  { field: 'state', aliases: ['province', 'region', 'state_province'], required: false },
  { field: 'zip_code', aliases: ['zip', 'postal_code', 'postcode', 'postal'], required: false },
  { field: 'notes', aliases: ['note', 'comments', 'description', 'memo'], required: false },
];

// Job field definitions for auto-mapping
export const JOB_FIELDS = [
  { field: 'title', aliases: ['job_title', 'job_name', 'name', 'work_order', 'service_title'], required: true },
  { field: 'description', aliases: ['details', 'job_description', 'notes', 'work_description'], required: false },
  { field: 'client_name', aliases: ['client', 'customer', 'customer_name', 'company'], required: false },
  { field: 'job_type', aliases: ['type', 'service_type', 'work_type', 'category'], required: false },
  { field: 'priority', aliases: ['urgency', 'priority_level'], required: false },
  { field: 'status', aliases: ['job_status', 'state', 'current_status'], required: false },
  { field: 'scheduled_date', aliases: ['date', 'service_date', 'appointment_date', 'schedule_date'], required: false },
  { field: 'scheduled_time', aliases: ['time', 'appointment_time', 'start_time'], required: false },
  { field: 'estimated_duration', aliases: ['duration', 'duration_minutes', 'time_estimate', 'est_duration'], required: false },
  { field: 'address', aliases: ['job_address', 'service_address', 'location', 'site_address'], required: false },
];

// Equipment field definitions for auto-mapping
export const EQUIPMENT_FIELDS = [
  { field: 'equipment_type', aliases: ['type', 'unit_type', 'equipment', 'category', 'asset_type'], required: true },
  { field: 'brand', aliases: ['manufacturer', 'make', 'brand_name'], required: false },
  { field: 'model', aliases: ['model_number', 'model_name', 'model_no'], required: false },
  { field: 'serial_number', aliases: ['serial', 'serial_no', 'sn', 'unit_serial'], required: false },
  { field: 'client_name', aliases: ['client', 'customer', 'customer_name', 'owner'], required: false },
  { field: 'install_date', aliases: ['installation_date', 'installed_on', 'date_installed'], required: false },
  { field: 'warranty_expiry', aliases: ['warranty_end', 'warranty_expires', 'warranty_date'], required: false },
  { field: 'status', aliases: ['equipment_status', 'condition', 'state'], required: false },
  { field: 'location_notes', aliases: ['location', 'notes', 'placement', 'site_notes'], required: false },
];

// Validate a row against required fields
export function validateRow(
  row: Record<string, string>,
  mappings: Record<string, string>,
  requiredFields: string[]
): string | null {
  for (const field of requiredFields) {
    const csvColumn = Object.keys(mappings).find(k => mappings[k] === field);
    if (!csvColumn || !row[csvColumn]?.trim()) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

// Parse date from various formats
export function parseDate(value: string): Date | null {
  if (!value?.trim()) return null;
  
  // Try common formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // MM-DD-YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/, // M/D/YY or M/D/YYYY
  ];
  
  for (const format of formats) {
    const match = value.match(format);
    if (match) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  // Try native parsing
  const date = new Date(value);
  if (!isNaN(date.getTime())) return date;
  
  return null;
}

// Parse priority value
export function parsePriority(value: string): 'low' | 'medium' | 'high' | 'urgent' {
  const normalized = value.toLowerCase().trim();
  if (['low', 'l', '1'].includes(normalized)) return 'low';
  if (['high', 'h', '3'].includes(normalized)) return 'high';
  if (['urgent', 'u', 'critical', '4'].includes(normalized)) return 'urgent';
  return 'medium';
}

// Parse status value
export function parseStatus(value: string): 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' {
  const normalized = value.toLowerCase().trim().replace(/[^a-z]/g, '');
  if (['scheduled', 'sched'].includes(normalized)) return 'scheduled';
  if (['inprogress', 'active', 'working', 'started'].includes(normalized)) return 'in_progress';
  if (['completed', 'complete', 'done', 'finished'].includes(normalized)) return 'completed';
  if (['cancelled', 'canceled', 'cancel'].includes(normalized)) return 'cancelled';
  return 'pending';
}

// Parse equipment status
export function parseEquipmentStatus(value: string): string {
  const normalized = value.toLowerCase().trim();
  if (['inactive', 'disabled', 'decommissioned'].includes(normalized)) return 'inactive';
  if (['maintenance', 'repair', 'service'].includes(normalized)) return 'maintenance';
  return 'active';
}

// Parse duration in minutes
export function parseDuration(value: string): number {
  const num = parseInt(value, 10);
  if (!isNaN(num) && num >= 15 && num <= 480) return num;
  return 60; // Default
}
