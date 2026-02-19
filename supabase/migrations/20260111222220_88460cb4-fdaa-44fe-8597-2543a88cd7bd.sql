-- Enforce single-company access: only one active tenant membership per user

-- Deactivate duplicate active tenant memberships (keep the earliest created_at)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS rn
  FROM public.tenant_users
  WHERE is_active = true
)
UPDATE public.tenant_users tu
SET is_active = false
FROM ranked r
WHERE tu.id = r.id
  AND r.rn > 1;

-- Add a partial unique index so a user can only have one active tenant membership
CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_one_active_per_user
  ON public.tenant_users (user_id)
  WHERE is_active = true;