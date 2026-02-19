import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RecurringTemplate {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  client_id: string | null;
  equipment_id: string | null;
  assigned_to: string | null;
  job_type: string | null;
  priority: string;
  estimated_duration: number;
  address: string | null;
  notes: string | null;
  recurrence_pattern: string;
  recurrence_day: number;
  recurrence_interval: number;
  next_occurrence: string;
  end_date: string | null;
  is_active: boolean;
  auto_assign: boolean;
  advance_days: number;
}

function calculateNextOccurrence(
  currentDate: Date,
  pattern: string,
  day: number,
  interval: number
): Date {
  const next = new Date(currentDate);
  
  switch (pattern) {
    case 'weekly':
      // Move to next occurrence based on interval weeks
      next.setDate(next.getDate() + (interval * 7));
      // Adjust to the correct day of week
      const currentDay = next.getDay();
      const diff = day - currentDay;
      next.setDate(next.getDate() + diff);
      break;
      
    case 'monthly':
      // Move to next month(s) based on interval
      next.setMonth(next.getMonth() + interval);
      // Set the day of month (handle month overflow)
      const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, maxDay));
      break;
      
    case 'quarterly':
      // Move 3 months forward
      next.setMonth(next.getMonth() + 3);
      const maxDayQ = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, maxDayQ));
      break;
      
    case 'annually':
      // Move 1 year forward
      next.setFullYear(next.getFullYear() + 1);
      const maxDayA = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, maxDayA));
      break;
  }
  
  return next;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    console.log(`[generate-recurring-jobs] Running for date: ${todayStr}`);
    
    // Find templates that need job generation
    // We look for templates where: next_occurrence - advance_days <= today
    // This means the job should be created today or earlier
    const { data: templates, error: fetchError } = await supabase
      .from('recurring_job_templates')
      .select('*')
      .eq('is_active', true);
    
    if (fetchError) {
      console.error('[generate-recurring-jobs] Error fetching templates:', fetchError);
      throw fetchError;
    }
    
    if (!templates || templates.length === 0) {
      console.log('[generate-recurring-jobs] No active templates found');
      return new Response(
        JSON.stringify({ message: 'No active templates', generated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[generate-recurring-jobs] Found ${templates.length} active templates`);
    
    let generatedCount = 0;
    const errors: string[] = [];
    
    for (const template of templates as RecurringTemplate[]) {
      try {
        // Check if past end date
        if (template.end_date && new Date(template.end_date) < today) {
          console.log(`[generate-recurring-jobs] Template ${template.id} past end date, skipping`);
          continue;
        }
        
        const nextOccurrence = new Date(template.next_occurrence);
        const createDate = new Date(nextOccurrence);
        createDate.setDate(createDate.getDate() - template.advance_days);
        
        // Check if we should create a job today
        if (createDate > today) {
          console.log(`[generate-recurring-jobs] Template ${template.id} not due yet (create date: ${createDate.toISOString().split('T')[0]})`);
          continue;
        }
        
        // Check if job already exists for this occurrence
        const { data: existingJobs, error: checkError } = await supabase
          .from('scheduled_jobs')
          .select('id')
          .eq('recurring_template_id', template.id)
          .eq('scheduled_date', template.next_occurrence)
          .limit(1);
        
        if (checkError) {
          console.error(`[generate-recurring-jobs] Error checking existing job for template ${template.id}:`, checkError);
          errors.push(`Template ${template.id}: ${checkError.message}`);
          continue;
        }
        
        if (existingJobs && existingJobs.length > 0) {
          console.log(`[generate-recurring-jobs] Job already exists for template ${template.id} on ${template.next_occurrence}`);
          // Still need to update next_occurrence
        } else {
          // Create the job
          const jobData = {
            tenant_id: template.tenant_id,
            title: template.title,
            description: template.description,
            client_id: template.client_id,
            equipment_id: template.equipment_id,
            assigned_to: template.auto_assign ? template.assigned_to : null,
            job_type: template.job_type,
            priority: template.priority,
            status: 'scheduled',
            scheduled_date: template.next_occurrence,
            estimated_duration: template.estimated_duration,
            address: template.address,
            notes: template.notes,
            recurring_template_id: template.id,
          };
          
          const { error: insertError } = await supabase
            .from('scheduled_jobs')
            .insert(jobData);
          
          if (insertError) {
            console.error(`[generate-recurring-jobs] Error creating job for template ${template.id}:`, insertError);
            errors.push(`Template ${template.id}: ${insertError.message}`);
            continue;
          }
          
          console.log(`[generate-recurring-jobs] Created job for template ${template.id} scheduled for ${template.next_occurrence}`);
          generatedCount++;
        }
        
        // Calculate and update next occurrence
        const currentOccurrence = new Date(template.next_occurrence);
        const nextOcc = calculateNextOccurrence(
          currentOccurrence,
          template.recurrence_pattern,
          template.recurrence_day,
          template.recurrence_interval
        );
        
        const nextOccStr = nextOcc.toISOString().split('T')[0];
        
        const { error: updateError } = await supabase
          .from('recurring_job_templates')
          .update({ next_occurrence: nextOccStr })
          .eq('id', template.id);
        
        if (updateError) {
          console.error(`[generate-recurring-jobs] Error updating next_occurrence for template ${template.id}:`, updateError);
          errors.push(`Template ${template.id} update: ${updateError.message}`);
        } else {
          console.log(`[generate-recurring-jobs] Updated template ${template.id} next_occurrence to ${nextOccStr}`);
        }
        
      } catch (templateError) {
        const errMsg = templateError instanceof Error ? templateError.message : String(templateError);
        console.error(`[generate-recurring-jobs] Error processing template ${template.id}:`, templateError);
        errors.push(`Template ${template.id}: ${errMsg}`);
      }
    }
    
    const response = {
      message: 'Recurring job generation complete',
      generated: generatedCount,
      templatesProcessed: templates.length,
      errors: errors.length > 0 ? errors : undefined,
    };
    
    console.log('[generate-recurring-jobs] Complete:', response);
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[generate-recurring-jobs] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
