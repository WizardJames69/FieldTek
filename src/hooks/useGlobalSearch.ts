import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

interface SearchResult {
  id: string;
  type: 'job' | 'client' | 'invoice';
  title: string;
  subtitle: string;
  status?: string;
}

interface SearchResults {
  jobs: SearchResult[];
  clients: SearchResult[];
  invoices: SearchResult[];
}

export function useGlobalSearch(query: string) {
  const [results, setResults] = useState<SearchResults>({
    jobs: [],
    clients: [],
    invoices: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const { tenant } = useTenant();

  const search = useCallback(async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2 || !tenant?.id) {
      setResults({ jobs: [], clients: [], invoices: [] });
      return;
    }

    setIsLoading(true);
    const searchPattern = `%${searchTerm}%`;

    try {
      const [jobsRes, clientsRes, invoicesRes] = await Promise.all([
        // Search jobs
        supabase
          .from('scheduled_jobs')
          .select('id, title, status, clients(name)')
          .eq('tenant_id', tenant.id)
          .or(`title.ilike.${searchPattern},description.ilike.${searchPattern},address.ilike.${searchPattern}`)
          .limit(5),

        // Search clients
        supabase
          .from('clients')
          .select('id, name, email, phone, city')
          .eq('tenant_id', tenant.id)
          .or(`name.ilike.${searchPattern},email.ilike.${searchPattern},phone.ilike.${searchPattern},city.ilike.${searchPattern}`)
          .limit(5),

        // Search invoices
        supabase
          .from('invoices')
          .select('id, invoice_number, status, total, clients(name)')
          .eq('tenant_id', tenant.id)
          .ilike('invoice_number', searchPattern)
          .limit(5),
      ]);

      setResults({
        jobs: (jobsRes.data || []).map((job: any) => ({
          id: job.id,
          type: 'job' as const,
          title: job.title,
          subtitle: job.clients?.name || 'No client',
          status: job.status,
        })),
        clients: (clientsRes.data || []).map((client: any) => ({
          id: client.id,
          type: 'client' as const,
          title: client.name,
          subtitle: [client.email, client.city].filter(Boolean).join(' • '),
        })),
        invoices: (invoicesRes.data || []).map((invoice: any) => ({
          id: invoice.id,
          type: 'invoice' as const,
          title: invoice.invoice_number,
          subtitle: invoice.clients?.name || 'No client',
          status: invoice.status,
        })),
      });
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query, search]);

  const totalResults = 
    results.jobs.length + 
    results.clients.length + 
    results.invoices.length;

  return { results, isLoading, totalResults };
}
