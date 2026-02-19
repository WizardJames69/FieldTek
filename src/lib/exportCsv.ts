import { format } from 'date-fns';

// Characters that trigger formula execution in spreadsheet apps (OWASP mitigation)
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

// Helper to escape CSV values with formula injection protection
function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Prevent formula injection by prefixing with single quote
  if (FORMULA_TRIGGERS.some(ch => str.startsWith(ch))) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  // If the value contains a comma, newline, or quote, wrap it in quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Generic CSV export function
function generateCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvValue).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvValue).join(','));
  return [headerLine, ...dataLines].join('\n');
}

// Download CSV file
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Job export
interface JobForExport {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  address: string | null;
  description: string | null;
  job_type: string | null;
  clients?: { name: string } | null;
  profiles?: { full_name: string | null } | null;
}

export function exportJobsToCsv(jobs: JobForExport[], filename?: string): void {
  const headers = [
    'Title',
    'Client',
    'Status',
    'Priority',
    'Date',
    'Time',
    'Duration (min)',
    'Type',
    'Address',
    'Assigned To',
    'Description',
  ];

  const rows = jobs.map((job) => [
    job.title,
    job.clients?.name || '',
    job.status || '',
    job.priority || '',
    job.scheduled_date ? format(new Date(job.scheduled_date), 'yyyy-MM-dd') : '',
    job.scheduled_time || '',
    job.estimated_duration,
    job.job_type || '',
    job.address || '',
    job.profiles?.full_name || '',
    job.description || '',
  ]);

  const csv = generateCsv(headers, rows);
  downloadCsv(csv, filename || `jobs-export-${format(new Date(), 'yyyy-MM-dd')}.csv`);
}

// Client export
interface ClientForExport {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
  job_count?: number;
  equipment_count?: number;
}

export function exportClientsToCsv(clients: ClientForExport[], filename?: string): void {
  const headers = [
    'Name',
    'Email',
    'Phone',
    'Address',
    'City',
    'State',
    'ZIP Code',
    'Jobs',
    'Equipment',
    'Notes',
  ];

  const rows = clients.map((client) => [
    client.name,
    client.email || '',
    client.phone || '',
    client.address || '',
    client.city || '',
    client.state || '',
    client.zip_code || '',
    client.job_count || 0,
    client.equipment_count || 0,
    client.notes || '',
  ]);

  const csv = generateCsv(headers, rows);
  downloadCsv(csv, filename || `clients-export-${format(new Date(), 'yyyy-MM-dd')}.csv`);
}

// Invoice export
interface InvoiceForExport {
  id: string;
  invoice_number: string;
  status: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total: number | null;
  due_date: string | null;
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
  clients?: { name: string; email: string | null } | null;
  scheduled_jobs?: { title: string } | null;
}

export function exportInvoicesToCsv(invoices: InvoiceForExport[], filename?: string): void {
  const headers = [
    'Invoice #',
    'Client',
    'Client Email',
    'Job',
    'Status',
    'Subtotal',
    'Tax',
    'Total',
    'Created',
    'Due Date',
    'Sent',
    'Paid',
  ];

  const rows = invoices.map((inv) => [
    inv.invoice_number,
    inv.clients?.name || '',
    inv.clients?.email || '',
    inv.scheduled_jobs?.title || '',
    inv.status || '',
    inv.subtotal?.toFixed(2) || '0.00',
    inv.tax_amount?.toFixed(2) || '0.00',
    inv.total?.toFixed(2) || '0.00',
    format(new Date(inv.created_at), 'yyyy-MM-dd'),
    inv.due_date ? format(new Date(inv.due_date), 'yyyy-MM-dd') : '',
    inv.sent_at ? format(new Date(inv.sent_at), 'yyyy-MM-dd') : '',
    inv.paid_at ? format(new Date(inv.paid_at), 'yyyy-MM-dd') : '',
  ]);

  const csv = generateCsv(headers, rows);
  downloadCsv(csv, filename || `invoices-export-${format(new Date(), 'yyyy-MM-dd')}.csv`);
}
