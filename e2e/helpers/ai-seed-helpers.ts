/**
 * AI seed helpers for global-setup.
 * Seeds documents, chunks, embeddings, compliance rules, graph data, Tenant B.
 */

import { getAdminClient } from './supabase-admin';
import {
  TEST_DOCUMENTS,
  SAMPLE_COMPLIANCE_RULES,
  SAMPLE_EQUIPMENT_COMPONENTS,
  SAMPLE_COMPONENT_RELATIONSHIPS,
  TENANT_B,
} from './ai-test-data';

/** Seed test documents into the documents table. Returns document IDs. */
export async function seedTestDocuments(tenantId: string): Promise<string[]> {
  const client = getAdminClient();
  const docIds: string[] = [];

  for (const doc of TEST_DOCUMENTS) {
    const { data } = await client
      .from('documents')
      .upsert(
        {
          tenant_id: tenantId,
          name: doc.name,
          category: doc.category,
          extraction_status: 'completed',
          embedding_status: 'completed',
          extracted_text: doc.chunks.map((c) => c.text).join('\n\n'),
        },
        { onConflict: 'tenant_id,name' },
      )
      .select('id')
      .single();
    if (data) docIds.push(data.id);
  }

  return docIds;
}

/** Seed document chunks with pre-computed embeddings. */
export async function seedDocumentChunks(
  tenantId: string,
  docIds: string[],
): Promise<void> {
  const client = getAdminClient();

  for (let i = 0; i < TEST_DOCUMENTS.length && i < docIds.length; i++) {
    for (let j = 0; j < TEST_DOCUMENTS[i].chunks.length; j++) {
      const chunk = TEST_DOCUMENTS[i].chunks[j];
      await client.from('document_chunks').upsert(
        {
          document_id: docIds[i],
          tenant_id: tenantId,
          chunk_text: chunk.text,
          chunk_index: j,
          embedding: JSON.stringify(chunk.embedding),
        },
        { onConflict: 'document_id,chunk_index' },
      );
    }
  }
}

/** Ensure all AI feature flags exist with default disabled state. */
export async function seedFeatureFlags(): Promise<void> {
  const client = getAdminClient();
  const flags = [
    'rag_judge',
    'rag_reranking',
    'compliance_engine',
    'equipment_graph',
    'judge_blocking_mode',
    'judge_full_blocking',
    'workflow_intelligence',
  ];

  for (const key of flags) {
    await client.from('feature_flags').upsert(
      {
        key,
        name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        is_enabled: false,
        rollout_percentage: 0,
      },
      { onConflict: 'key' },
    );
  }
}

/** Create/update tenant AI policy (enables AI for the test tenant). */
export async function seedTenantAIPolicy(tenantId: string): Promise<void> {
  const client = getAdminClient();
  await client.from('tenant_ai_policies').upsert(
    {
      tenant_id: tenantId,
      ai_enabled: true,
      max_monthly_requests: null,
      similarity_threshold: 0.55,
      blocked_topics: [],
      custom_disclaimer: null,
    },
    { onConflict: 'tenant_id' },
  );
}

/** Seed compliance rules for testing. */
export async function seedComplianceRules(tenantId: string): Promise<void> {
  const client = getAdminClient();
  for (const rule of SAMPLE_COMPLIANCE_RULES) {
    await client.from('compliance_rules').upsert(
      {
        tenant_id: tenantId,
        industry: 'hvac',
        is_active: true,
        ...rule,
      },
      { onConflict: 'tenant_id,rule_key' },
    );
  }
}

/** Seed equipment components and their relationships. */
export async function seedEquipmentComponents(tenantId: string): Promise<void> {
  const client = getAdminClient();
  const componentIds: Record<string, string> = {};

  for (const comp of SAMPLE_EQUIPMENT_COMPONENTS) {
    const { data } = await client
      .from('equipment_components')
      .upsert(
        {
          tenant_id: null, // global defaults
          component_name: comp.component_name,
          component_category: 'core',
          equipment_type: comp.equipment_type,
          failure_modes: comp.failure_modes,
          diagnostic_keywords: comp.diagnostic_keywords,
          is_active: true,
        },
        { onConflict: 'tenant_id,component_name,equipment_type' },
      )
      .select('id')
      .single();
    if (data) componentIds[comp.component_name] = data.id;
  }

  for (const rel of SAMPLE_COMPONENT_RELATIONSHIPS) {
    if (componentIds[rel.source] && componentIds[rel.target]) {
      await client.from('component_relationships').upsert(
        {
          source_id: componentIds[rel.source],
          target_id: componentIds[rel.target],
          relationship: rel.relationship,
          weight: rel.weight,
        },
        { onConflict: 'source_id,target_id,relationship' },
      );
    }
  }
}

/** Seed workflow intelligence graph nodes and edges. */
export async function seedWorkflowIntelligence(tenantId: string): Promise<void> {
  const client = getAdminClient();

  const { data: s1 } = await client
    .from('workflow_symptoms')
    .upsert(
      {
        tenant_id: tenantId,
        symptom_key: 'no_cooling',
        symptom_label: 'No Cooling',
        equipment_type: 'Air Handler',
        category: 'temperature',
        occurrence_count: 15,
      },
      { onConflict: 'tenant_id,symptom_key' },
    )
    .select('id')
    .single();

  const { data: f1 } = await client
    .from('workflow_failures')
    .upsert(
      {
        tenant_id: tenantId,
        failure_key: 'capacitor_failure',
        failure_label: 'Capacitor Failure',
        equipment_type: 'Air Handler',
        occurrence_count: 8,
      },
      { onConflict: 'tenant_id,failure_key' },
    )
    .select('id')
    .single();

  if (s1 && f1) {
    await client.from('workflow_intelligence_edges').upsert(
      {
        tenant_id: tenantId,
        source_type: 'symptom',
        source_id: s1.id,
        target_type: 'failure',
        target_id: f1.id,
        edge_type: 'leads_to',
        frequency: 8,
        probability: 0.53,
      },
      { onConflict: 'tenant_id,source_type,source_id,target_type,target_id,edge_type' },
    );
  }

  await client.from('workflow_outcomes').upsert(
    {
      tenant_id: tenantId,
      outcome_key: 'resolved_first_visit',
      outcome_label: 'Resolved First Visit',
      outcome_type: 'resolved',
      occurrence_count: 12,
    },
    { onConflict: 'tenant_id,outcome_key' },
  );
}

/** Seed Tenant B for multi-tenant isolation tests. */
export async function seedTenantB(): Promise<{ tenantId: string; userId: string }> {
  const client = getAdminClient();

  // Create or reuse user
  const { data: list } = await client.auth.admin.listUsers();
  let userId: string;
  const existing = list?.users?.find((u) => u.email === TENANT_B.user.email);

  if (existing) {
    userId = existing.id;
    await client.auth.admin.updateUserById(existing.id, {
      password: TENANT_B.user.password,
      email_confirm: true,
    });
  } else {
    const { data } = await client.auth.admin.createUser({
      email: TENANT_B.user.email,
      password: TENANT_B.user.password,
      email_confirm: true,
      user_metadata: { full_name: TENANT_B.user.fullName },
    });
    userId = data!.user!.id;
  }

  await client.from('profiles').upsert(
    { user_id: userId, full_name: TENANT_B.user.fullName, email: TENANT_B.user.email },
    { onConflict: 'user_id' },
  );

  // Create or reuse tenant
  const { data: existingTenant } = await client
    .from('tenants')
    .select('id')
    .eq('name', TENANT_B.name)
    .maybeSingle();

  let tenantId: string;

  if (existingTenant) {
    tenantId = existingTenant.id;
  } else {
    const { data: tenant } = await client
      .from('tenants')
      .insert({
        name: TENANT_B.name,
        slug: `e2e-tenant-b-${Date.now()}`,
        industry: TENANT_B.industry,
        owner_id: userId,
        subscription_tier: 'professional',
        subscription_status: 'active',
      })
      .select()
      .single();
    tenantId = tenant!.id;

    await client.from('tenant_users').insert({
      tenant_id: tenantId,
      user_id: userId,
      role: 'owner',
      is_active: true,
    });
    await client.from('tenant_settings').insert({
      tenant_id: tenantId,
      equipment_types: ['Water Heater'],
      job_types: ['Repair'],
      workflow_stages: ['Scheduled', 'Complete'],
      document_categories: ['Manual'],
    });
    await client.from('tenant_branding').insert({
      tenant_id: tenantId,
      company_name: TENANT_B.name,
      primary_color: '#2563eb',
      secondary_color: '#10b981',
    });
  }

  // Seed Tenant B AI policy
  await client.from('tenant_ai_policies').upsert(
    { tenant_id: tenantId, ai_enabled: true },
    { onConflict: 'tenant_id' },
  );

  return { tenantId, userId };
}

/** Clean up Tenant B and its user. */
export async function cleanupTenantB(): Promise<void> {
  const client = getAdminClient();

  const { data: tenant } = await client
    .from('tenants')
    .select('id')
    .eq('name', TENANT_B.name)
    .maybeSingle();

  if (tenant) {
    await client.from('tenants').delete().eq('id', tenant.id);
  }

  const { data: list } = await client.auth.admin.listUsers();
  const user = list?.users?.find((u) => u.email === TENANT_B.user.email);
  if (user) {
    await client.auth.admin.deleteUser(user.id);
  }
}
