import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ImportType } from '@/components/import/CSVImportDialog';

interface UseDuplicateDetectionResult {
  duplicateIndices: Set<number>;
  duplicateCount: number;
  isChecking: boolean;
}

export function useDuplicateDetection(
  importType: ImportType,
  rows: Record<string, string>[] | null,
  mappings: Record<string, string>,
  enabled: boolean
): UseDuplicateDetectionResult {
  const [duplicateIndices, setDuplicateIndices] = useState<Set<number>>(new Set());
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!enabled || !rows?.length) {
      setDuplicateIndices(new Set());
      return;
    }

    const check = async () => {
      setIsChecking(true);
      try {
        const indices = await detectDuplicates(importType, rows, mappings);
        setDuplicateIndices(indices);
      } catch (err) {
        console.error('Duplicate detection failed:', err);
        setDuplicateIndices(new Set());
      } finally {
        setIsChecking(false);
      }
    };

    check();
  }, [enabled, importType, rows, mappings]);

  return { duplicateIndices, duplicateCount: duplicateIndices.size, isChecking };
}

// Reverse-lookup: find which CSV column maps to a given field
function getCsvColumn(mappings: Record<string, string>, field: string): string | undefined {
  return Object.entries(mappings).find(([, f]) => f === field)?.[0];
}

async function detectDuplicates(
  importType: ImportType,
  rows: Record<string, string>[],
  mappings: Record<string, string>
): Promise<Set<number>> {
  const indices = new Set<number>();

  if (importType === 'clients') {
    const { data } = await supabase.from('clients').select('name, email');
    if (!data?.length) return indices;

    const existingNames = new Set(data.map(c => c.name?.toLowerCase()).filter(Boolean));
    const existingEmails = new Set(data.map(c => c.email?.toLowerCase()).filter(Boolean));

    const nameCol = getCsvColumn(mappings, 'name');
    const emailCol = getCsvColumn(mappings, 'email');

    rows.forEach((row, i) => {
      const name = nameCol ? row[nameCol]?.trim().toLowerCase() : '';
      const email = emailCol ? row[emailCol]?.trim().toLowerCase() : '';
      if ((name && existingNames.has(name)) || (email && existingEmails.has(email))) {
        indices.add(i);
      }
    });
  } else if (importType === 'jobs') {
    const { data } = await supabase.from('scheduled_jobs').select('title, scheduled_date');
    if (!data?.length) return indices;

    const existingJobs = new Set(
      data.map(j => `${j.title?.toLowerCase()}|${j.scheduled_date}`)
    );

    const titleCol = getCsvColumn(mappings, 'title');
    const dateCol = getCsvColumn(mappings, 'scheduled_date');

    rows.forEach((row, i) => {
      const title = titleCol ? row[titleCol]?.trim().toLowerCase() : '';
      const date = dateCol ? row[dateCol]?.trim() : '';
      if (title && date && existingJobs.has(`${title}|${date}`)) {
        indices.add(i);
      }
    });
  } else if (importType === 'equipment') {
    const { data } = await supabase.from('equipment_registry').select('serial_number');
    if (!data?.length) return indices;

    const existingSerials = new Set(
      data.map(e => e.serial_number?.toLowerCase()).filter(Boolean)
    );

    const serialCol = getCsvColumn(mappings, 'serial_number');

    rows.forEach((row, i) => {
      const serial = serialCol ? row[serialCol]?.trim().toLowerCase() : '';
      if (serial && existingSerials.has(serial)) {
        indices.add(i);
      }
    });
  }

  return indices;
}
