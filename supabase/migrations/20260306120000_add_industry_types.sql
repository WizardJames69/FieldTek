-- Add new industry types to the industry_type enum
ALTER TYPE public.industry_type ADD VALUE IF NOT EXISTS 'fire_safety';
ALTER TYPE public.industry_type ADD VALUE IF NOT EXISTS 'refrigeration';
ALTER TYPE public.industry_type ADD VALUE IF NOT EXISTS 'building_automation';
ALTER TYPE public.industry_type ADD VALUE IF NOT EXISTS 'appliance';
ALTER TYPE public.industry_type ADD VALUE IF NOT EXISTS 'industrial_maintenance';
ALTER TYPE public.industry_type ADD VALUE IF NOT EXISTS 'aviation_maintenance';
