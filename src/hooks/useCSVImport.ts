import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { 
  validateRow, 
  parseDate, 
  parsePriority, 
  parseStatus, 
  parseEquipmentStatus,
  parseDuration,
  CLIENT_FIELDS,
  JOB_FIELDS,
  EQUIPMENT_FIELDS,
  type ImportResult 
} from '@/lib/csvParser';

export function useCSVImport() {
  const { tenant } = useTenant();

  const importClients = useCallback(async (
    rows: Record<string, string>[],
    mappings: Record<string, string>
  ): Promise<ImportResult> => {
    if (!tenant?.id) {
      return { success: 0, failed: rows.length, errors: [{ row: 0, error: 'No tenant context' }] };
    }

    const requiredFields = CLIENT_FIELDS.filter(f => f.required).map(f => f.field);
    const result: ImportResult = { success: 0, failed: 0, errors: [] };

    // Prepare batch insert data
    const validClients: Array<{
      tenant_id: string;
      name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zip_code: string | null;
      notes: string | null;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Account for header row and 0-indexing
      
      // Validate required fields
      const error = validateRow(row, mappings, requiredFields);
      if (error) {
        result.failed++;
        result.errors.push({ row: rowNum, error });
        continue;
      }

      // Get mapped values
      const getValue = (field: string): string | null => {
        const csvCol = Object.keys(mappings).find(k => mappings[k] === field);
        return csvCol ? (row[csvCol]?.trim() || null) : null;
      };

      validClients.push({
        tenant_id: tenant.id,
        name: getValue('name') || '',
        email: getValue('email'),
        phone: getValue('phone'),
        address: getValue('address'),
        city: getValue('city'),
        state: getValue('state'),
        zip_code: getValue('zip_code'),
        notes: getValue('notes'),
      });
    }

    // Batch insert in chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < validClients.length; i += chunkSize) {
      const chunk = validClients.slice(i, i + chunkSize);
      
      const { error } = await supabase
        .from('clients')
        .insert(chunk);

      if (error) {
        // Mark all in chunk as failed
        chunk.forEach((_, idx) => {
          result.failed++;
          result.errors.push({ 
            row: i + idx + 2, 
            error: error.message 
          });
        });
      } else {
        result.success += chunk.length;
      }
    }

    if (result.success > 0) {
      toast.success(`Imported ${result.success} clients successfully`);
    }

    return result;
  }, [tenant?.id]);

  const importJobs = useCallback(async (
    rows: Record<string, string>[],
    mappings: Record<string, string>
  ): Promise<ImportResult> => {
    if (!tenant?.id) {
      return { success: 0, failed: rows.length, errors: [{ row: 0, error: 'No tenant context' }] };
    }

    const requiredFields = JOB_FIELDS.filter(f => f.required).map(f => f.field);
    const result: ImportResult = { success: 0, failed: 0, errors: [] };

    // Fetch existing clients for name matching
    const { data: existingClients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('tenant_id', tenant.id);

    const clientNameToId = new Map(
      (existingClients || []).map(c => [c.name.toLowerCase(), c.id])
    );

    const validJobs: Array<{
      tenant_id: string;
      title: string;
      description: string | null;
      client_id: string | null;
      job_type: string | null;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
      scheduled_date: string | null;
      scheduled_time: string | null;
      estimated_duration: number;
      address: string | null;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      
      const error = validateRow(row, mappings, requiredFields);
      if (error) {
        result.failed++;
        result.errors.push({ row: rowNum, error });
        continue;
      }

      const getValue = (field: string): string | null => {
        const csvCol = Object.keys(mappings).find(k => mappings[k] === field);
        return csvCol ? (row[csvCol]?.trim() || null) : null;
      };

      // Match client by name
      const clientName = getValue('client_name');
      const clientId = clientName ? clientNameToId.get(clientName.toLowerCase()) : null;

      // Parse date
      const dateStr = getValue('scheduled_date');
      const parsedDate = dateStr ? parseDate(dateStr) : null;

      validJobs.push({
        tenant_id: tenant.id,
        title: getValue('title') || '',
        description: getValue('description'),
        client_id: clientId || null,
        job_type: getValue('job_type'),
        priority: parsePriority(getValue('priority') || 'medium'),
        status: parseStatus(getValue('status') || 'pending'),
        scheduled_date: parsedDate ? parsedDate.toISOString().split('T')[0] : null,
        scheduled_time: getValue('scheduled_time'),
        estimated_duration: parseDuration(getValue('estimated_duration') || '60'),
        address: getValue('address'),
      });
    }

    // Batch insert
    const chunkSize = 100;
    for (let i = 0; i < validJobs.length; i += chunkSize) {
      const chunk = validJobs.slice(i, i + chunkSize);
      
      const { error } = await supabase
        .from('scheduled_jobs')
        .insert(chunk);

      if (error) {
        chunk.forEach((_, idx) => {
          result.failed++;
          result.errors.push({ row: i + idx + 2, error: error.message });
        });
      } else {
        result.success += chunk.length;
      }
    }

    if (result.success > 0) {
      toast.success(`Imported ${result.success} jobs successfully`);
    }

    return result;
  }, [tenant?.id]);

  const importEquipment = useCallback(async (
    rows: Record<string, string>[],
    mappings: Record<string, string>
  ): Promise<ImportResult> => {
    if (!tenant?.id) {
      return { success: 0, failed: rows.length, errors: [{ row: 0, error: 'No tenant context' }] };
    }

    const requiredFields = EQUIPMENT_FIELDS.filter(f => f.required).map(f => f.field);
    const result: ImportResult = { success: 0, failed: 0, errors: [] };

    // Fetch existing clients for name matching
    const { data: existingClients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('tenant_id', tenant.id);

    const clientNameToId = new Map(
      (existingClients || []).map(c => [c.name.toLowerCase(), c.id])
    );

    const validEquipment: Array<{
      tenant_id: string;
      equipment_type: string;
      brand: string | null;
      model: string | null;
      serial_number: string | null;
      client_id: string | null;
      install_date: string | null;
      warranty_expiry: string | null;
      status: string;
      location_notes: string | null;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      
      const error = validateRow(row, mappings, requiredFields);
      if (error) {
        result.failed++;
        result.errors.push({ row: rowNum, error });
        continue;
      }

      const getValue = (field: string): string | null => {
        const csvCol = Object.keys(mappings).find(k => mappings[k] === field);
        return csvCol ? (row[csvCol]?.trim() || null) : null;
      };

      // Match client by name
      const clientName = getValue('client_name');
      const clientId = clientName ? clientNameToId.get(clientName.toLowerCase()) : null;

      // Parse dates
      const installDateStr = getValue('install_date');
      const warrantyDateStr = getValue('warranty_expiry');
      const installDate = installDateStr ? parseDate(installDateStr) : null;
      const warrantyDate = warrantyDateStr ? parseDate(warrantyDateStr) : null;

      validEquipment.push({
        tenant_id: tenant.id,
        equipment_type: getValue('equipment_type') || '',
        brand: getValue('brand'),
        model: getValue('model'),
        serial_number: getValue('serial_number'),
        client_id: clientId || null,
        install_date: installDate ? installDate.toISOString().split('T')[0] : null,
        warranty_expiry: warrantyDate ? warrantyDate.toISOString().split('T')[0] : null,
        status: parseEquipmentStatus(getValue('status') || 'active'),
        location_notes: getValue('location_notes'),
      });
    }

    // Batch insert
    const chunkSize = 100;
    for (let i = 0; i < validEquipment.length; i += chunkSize) {
      const chunk = validEquipment.slice(i, i + chunkSize);
      
      const { error } = await supabase
        .from('equipment_registry')
        .insert(chunk);

      if (error) {
        chunk.forEach((_, idx) => {
          result.failed++;
          result.errors.push({ row: i + idx + 2, error: error.message });
        });
      } else {
        result.success += chunk.length;
      }
    }

    if (result.success > 0) {
      toast.success(`Imported ${result.success} equipment records successfully`);
    }

    return result;
  }, [tenant?.id]);

  return { importClients, importJobs, importEquipment };
}
