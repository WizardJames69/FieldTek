import { supabase } from '@/integrations/supabase/client';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  type?: 'job_assignment' | 'job_status_change' | 'service_request' | 'general';
  data?: {
    jobId?: string;
    url?: string;
    [key: string]: unknown;
  };
  actions?: Array<{ action: string; title: string }>;
}

/**
 * Send a push notification to a specific user
 */
export async function sendPushToUser(
  userId: string,
  tenantId: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId,
        tenantId,
        payload,
      },
    });

    if (error) {
      console.error('Push notification error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, ...data };
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Send a push notification to multiple users
 */
export async function sendPushToUsers(
  userIds: string[],
  tenantId: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; sent?: number; error?: string }> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userIds,
        tenantId,
        payload,
      },
    });

    if (error) {
      console.error('Push notification error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, ...data };
  } catch (error) {
    console.error('Failed to send push notifications:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Send job assignment notification
 */
export async function notifyJobAssignment(
  technicianUserId: string,
  tenantId: string,
  jobDetails: {
    jobId: string;
    jobTitle: string;
    clientName: string;
    scheduledDate: string;
    address?: string;
  }
): Promise<void> {
  await sendPushToUser(technicianUserId, tenantId, {
    title: '🔧 New Job Assignment',
    body: `${jobDetails.jobTitle} for ${jobDetails.clientName} on ${jobDetails.scheduledDate}`,
    type: 'job_assignment',
    tag: `job_assignment_${jobDetails.jobId}`,
    data: {
      jobId: jobDetails.jobId,
      url: `/my-jobs?job=${jobDetails.jobId}`,
    },
    actions: [
      { action: 'view', title: 'View Job' },
    ],
  });
}

/**
 * Send job status change notification
 */
export async function notifyJobStatusChange(
  userIds: string[],
  tenantId: string,
  jobDetails: {
    jobId: string;
    jobTitle: string;
    oldStatus: string;
    newStatus: string;
    clientName: string;
  }
): Promise<void> {
  const statusEmojis: Record<string, string> = {
    scheduled: '📅',
    in_progress: '🔄',
    completed: '✅',
    cancelled: '❌',
    pending: '⏳',
  };

  const emoji = statusEmojis[jobDetails.newStatus] || '📋';

  await sendPushToUsers(userIds, tenantId, {
    title: `${emoji} Job Status Updated`,
    body: `${jobDetails.jobTitle}: ${jobDetails.oldStatus} → ${jobDetails.newStatus}`,
    type: 'job_status_change',
    tag: `job_status_${jobDetails.jobId}`,
    data: {
      jobId: jobDetails.jobId,
      url: `/jobs?job=${jobDetails.jobId}`,
    },
    actions: [
      { action: 'view', title: 'View Details' },
    ],
  });
}

/**
 * Notify dispatchers when a job is completed
 */
export async function notifyJobCompleted(
  tenantId: string,
  jobDetails: {
    jobId: string;
    jobTitle: string;
    clientName: string;
    technicianName?: string;
  }
): Promise<void> {
  try {
    // Fetch all dispatchers/admins/owners for the tenant
    const { data: tenantUsers, error } = await supabase
      .from('tenant_users')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('role', ['owner', 'admin', 'dispatcher']);

    if (error || !tenantUsers?.length) {
      console.log('No dispatchers found to notify');
      return;
    }

    const dispatcherIds = tenantUsers.map(u => u.user_id);

    await sendPushToUsers(dispatcherIds, tenantId, {
      title: '✅ Job Completed',
      body: jobDetails.technicianName 
        ? `${jobDetails.jobTitle} for ${jobDetails.clientName} completed by ${jobDetails.technicianName}`
        : `${jobDetails.jobTitle} for ${jobDetails.clientName} has been completed`,
      type: 'job_status_change',
      tag: `job_completed_${jobDetails.jobId}`,
      data: {
        jobId: jobDetails.jobId,
        url: `/jobs?job=${jobDetails.jobId}`,
      },
      actions: [
        { action: 'view', title: 'View Job' },
      ],
    });
  } catch (error) {
    console.error('Failed to notify dispatchers:', error);
  }
}

/**
 * Notify dispatchers when a new service request is submitted
 */
export async function notifyNewServiceRequest(
  tenantId: string,
  requestDetails: {
    requestId: string;
    title: string;
    requestType: string;
    customerName?: string;
  }
): Promise<void> {
  try {
    // Fetch all dispatchers/admins/owners for the tenant
    const { data: tenantUsers, error } = await supabase
      .from('tenant_users')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('role', ['owner', 'admin', 'dispatcher']);

    if (error || !tenantUsers?.length) {
      console.log('No dispatchers found to notify about service request');
      return;
    }

    const dispatcherIds = tenantUsers.map(u => u.user_id);

    await sendPushToUsers(dispatcherIds, tenantId, {
      title: '📨 New Service Request',
      body: requestDetails.customerName 
        ? `${requestDetails.requestType}: ${requestDetails.title} from ${requestDetails.customerName}`
        : `${requestDetails.requestType}: ${requestDetails.title}`,
      type: 'service_request',
      tag: `service_request_${requestDetails.requestId}`,
      data: {
        requestId: requestDetails.requestId,
        url: `/service-requests?request=${requestDetails.requestId}`,
      },
      actions: [
        { action: 'view', title: 'View Request' },
      ],
    });
  } catch (error) {
    console.error('Failed to notify dispatchers about service request:', error);
  }
}

/**
 * Notify office staff when an invoice is marked as paid
 */
export async function notifyInvoicePaid(
  tenantId: string,
  invoiceDetails: {
    invoiceId: string;
    invoiceNumber: string;
    clientName: string;
    amount: number;
  }
): Promise<void> {
  try {
    // Fetch all office staff (owners, admins, dispatchers) for the tenant
    const { data: tenantUsers, error } = await supabase
      .from('tenant_users')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('role', ['owner', 'admin', 'dispatcher']);

    if (error || !tenantUsers?.length) {
      console.log('No office staff found to notify about payment');
      return;
    }

    const staffIds = tenantUsers.map(u => u.user_id);

    await sendPushToUsers(staffIds, tenantId, {
      title: '💰 Invoice Paid',
      body: `${invoiceDetails.invoiceNumber} from ${invoiceDetails.clientName} - $${invoiceDetails.amount.toFixed(2)}`,
      type: 'general',
      tag: `invoice_paid_${invoiceDetails.invoiceId}`,
      data: {
        invoiceId: invoiceDetails.invoiceId,
        url: `/invoices?invoice=${invoiceDetails.invoiceId}`,
      },
      actions: [
        { action: 'view', title: 'View Invoice' },
      ],
    });
  } catch (error) {
    console.error('Failed to notify office staff about payment:', error);
  }
}

/**
 * Notify platform admins when a new beta application is submitted
 */
export async function notifyNewBetaApplication(
  applicationDetails: {
    email: string;
    companyName: string;
    industry: string;
    teamSize: string;
  }
): Promise<void> {
  try {
    // Fetch all platform admins
    const { data: platformAdmins, error } = await supabase
      .from('platform_admins')
      .select('user_id');

    if (error || !platformAdmins?.length) {
      console.log('No platform admins found to notify about beta application');
      return;
    }

    const adminIds = platformAdmins.map(a => a.user_id);

    // We need a tenant_id for push notifications, but platform admins may not have one
    // We'll use a special system notification approach
    for (const adminId of adminIds) {
      // Get the admin's tenant (if they have one)
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', adminId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (tenantUser?.tenant_id) {
        await sendPushToUser(adminId, tenantUser.tenant_id, {
          title: '🎉 New Beta Application!',
          body: `${applicationDetails.companyName} (${applicationDetails.industry}) - ${applicationDetails.teamSize}`,
          type: 'general',
          tag: `beta_application_${Date.now()}`,
          data: {
            url: '/admin/beta-applications',
          },
          actions: [
            { action: 'view', title: 'Review Application' },
          ],
        });
      }
    }
    
    console.log('Notified platform admins about new beta application');
  } catch (error) {
    console.error('Failed to notify platform admins about beta application:', error);
  }
}
