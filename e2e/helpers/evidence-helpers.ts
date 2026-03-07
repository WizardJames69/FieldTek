/**
 * Evidence helpers for workflow step verification E2E tests.
 * Seed evidence records, configure required_evidence on templates.
 */

import { getAdminClient } from './supabase-admin';

export interface SeedEvidenceParams {
  tenantId: string;
  jobId: string;
  checklistItemId: string;
  stageName: string;
  technicianId: string;
  evidenceType: 'photo' | 'measurement' | 'serial_scan' | 'gps_checkin';
  photoUrl?: string;
  measurementValue?: number;
  measurementUnit?: string;
  serialNumber?: string;
  gpsLocation?: { latitude: number; longitude: number; accuracy: number };
  verificationStatus?: 'pending' | 'verified' | 'failed' | 'flagged';
}

export async function seedEvidenceRecord(params: SeedEvidenceParams) {
  const client = getAdminClient();
  const { data, error } = await client
    .from('workflow_step_evidence')
    .insert({
      tenant_id: params.tenantId,
      job_id: params.jobId,
      checklist_item_id: params.checklistItemId,
      stage_name: params.stageName,
      technician_id: params.technicianId,
      evidence_type: params.evidenceType,
      photo_url: params.photoUrl ?? null,
      measurement_value: params.measurementValue ?? null,
      measurement_unit: params.measurementUnit ?? null,
      serial_number: params.serialNumber ?? null,
      gps_location: params.gpsLocation ?? null,
      verification_status: params.verificationStatus ?? 'pending',
      device_timestamp: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to seed evidence: ${error.message}`);
  return data;
}

export async function getEvidenceForJob(jobId: string) {
  const client = getAdminClient();
  const { data, error } = await client
    .from('workflow_step_evidence')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch evidence: ${error.message}`);
  return data ?? [];
}

export async function deleteEvidenceForJob(jobId: string) {
  const client = getAdminClient();
  const { error } = await client
    .from('workflow_step_evidence')
    .delete()
    .eq('job_id', jobId);

  if (error) throw new Error(`Failed to delete evidence: ${error.message}`);
}

export interface RequiredEvidenceConfig {
  [checklistItemId: string]: {
    photo?: boolean;
    measurement?: { unit: string; min?: number; max?: number };
    gps_required?: boolean;
    serial_scan?: boolean;
  };
}

export async function setTemplateRequiredEvidence(
  tenantId: string,
  stageName: string,
  requiredEvidence: RequiredEvidenceConfig,
  jobType?: string,
) {
  const client = getAdminClient();

  // Find or create template
  const query = client
    .from('job_stage_templates')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('stage_name', stageName);

  if (jobType) query.eq('job_type', jobType);

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const { error } = await client
      .from('job_stage_templates')
      .update({ required_evidence: requiredEvidence })
      .eq('id', existing.id);
    if (error) throw new Error(`Failed to update template: ${error.message}`);
  } else {
    const { error } = await client.from('job_stage_templates').insert({
      tenant_id: tenantId,
      stage_name: stageName,
      job_type: jobType ?? 'Service',
      checklist_items: [],
      required_evidence: requiredEvidence,
      order_index: 0,
    });
    if (error) throw new Error(`Failed to create template: ${error.message}`);
  }
}

export async function clearTemplateRequiredEvidence(tenantId: string, stageName: string) {
  const client = getAdminClient();
  const { error } = await client
    .from('job_stage_templates')
    .update({ required_evidence: {} })
    .eq('tenant_id', tenantId)
    .eq('stage_name', stageName);
  if (error) console.warn(`Failed to clear template evidence: ${error.message}`);
}
