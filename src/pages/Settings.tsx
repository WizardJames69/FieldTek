import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  ClipboardList,
  CreditCard,
  KeyRound,
  ListChecks,
  Package,
  Palette,
  Settings2,
  SlidersHorizontal,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { BrandingSettings } from '@/components/settings/BrandingSettings';
import { JobTypesSettings } from '@/components/settings/JobTypesSettings';
import { EquipmentTypesSettings } from '@/components/settings/EquipmentTypesSettings';
import { FeatureSettings } from '@/components/settings/FeatureSettings';
import { BillingSettings } from '@/components/settings/BillingSettings';
import { PartsCatalogSettings } from '@/components/settings/PartsCatalogSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { ChecklistTemplateSettings } from '@/components/settings/ChecklistTemplateSettings';
import { WorkflowTemplateList } from '@/components/settings/workflows/WorkflowTemplateList';
import { APISettings } from '@/components/settings/APISettings';
import { CalendarSettings } from '@/components/settings/CalendarSettings';
import { useUserRole } from '@/contexts/TenantContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Settings shell: a sectioned left rail (Stripe/Notion pattern) on desktop, a
 * horizontally scrolling pill bar on mobile. Deliberately still Radix Tabs on
 * the flat /settings route with a ?tab= query param:
 * - ~34 call sites deep-link /settings?tab=billing|branding and keep working
 *   with zero edits (no nested-route migration).
 * - role="tablist"/role="tab" semantics survive, so the settings e2e page
 *   object needs no changes.
 * The tabs are controlled and URL-synced (the old shell read ?tab= once at
 * mount and never wrote it back, so the URL went stale as you navigated).
 * Tab VALUE strings and LABEL text are load-bearing: values are the public
 * deep-link contract, labels are matched by e2e getByRole('tab', {name}).
 */

interface SettingsTab {
  value: string;
  label: string;
  icon: LucideIcon;
}

interface SettingsGroup {
  heading: string;
  tabs: SettingsTab[];
}

const RAIL_TRIGGER_CLASSES = [
  // Neutralize the horizontal-pill defaults from tabsTriggerVariants, then
  // restate the quiet row treatment (active row = muted fill, not primary).
  'w-full justify-start gap-2.5 rounded-lg px-3 py-2 text-sm shrink-0',
  'text-muted-foreground hover:text-foreground hover:bg-muted/60',
  'data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none',
].join(' ');

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isOwner } = useUserRole();
  const { isEnabled } = useFeatureFlags();
  const isMobile = useIsMobile();
  const showWorkflows = isEnabled('workflow_templates');

  const groups = useMemo<SettingsGroup[]>(() => {
    const list: SettingsGroup[] = [
      {
        heading: 'Workspace',
        tabs: [
          { value: 'general', label: 'General', icon: Settings2 },
          { value: 'branding', label: 'Branding', icon: Palette },
          { value: 'notifications', label: 'Notifications', icon: Bell },
        ],
      },
      {
        heading: 'Jobs & Workflows',
        tabs: [
          { value: 'job-types', label: 'Job Types', icon: ClipboardList },
          { value: 'equipment', label: 'Equipment', icon: Wrench },
          { value: 'parts', label: 'Parts', icon: Package },
          { value: 'checklists', label: 'Checklists', icon: ListChecks },
          ...(showWorkflows
            ? [{ value: 'workflows', label: 'Workflows', icon: Workflow }]
            : []),
          { value: 'calendar', label: 'Calendar', icon: CalendarDays },
        ],
      },
      ...(isOwner
        ? [
            {
              heading: 'Billing',
              tabs: [{ value: 'billing', label: 'Billing', icon: CreditCard }],
            },
          ]
        : []),
      {
        heading: 'Integrations',
        tabs: [{ value: 'api', label: 'API', icon: KeyRound }],
      },
      {
        heading: 'Advanced',
        tabs: [{ value: 'features', label: 'Features', icon: SlidersHorizontal }],
      },
    ];
    return list;
  }, [isOwner, showWorkflows]);

  // Derive the active tab from the URL every render: deep links land directly,
  // and a gated value (billing for a non-owner, workflows with the flag off,
  // or any unknown string) falls back to General instead of rendering an
  // empty content pane. The URL is deliberately NOT rewritten on fallback:
  // ?tab=billing can arrive while the role is still loading (isOwner false),
  // and rewriting would destroy the param before the role resolves. Keeping
  // the raw param means the intended tab activates itself once its gate opens.
  const visibleValues = useMemo(
    () => new Set(groups.flatMap((g) => g.tabs.map((t) => t.value))),
    [groups],
  );
  const rawTab = searchParams.get('tab');
  const tab = rawTab && visibleValues.has(rawTab) ? rawTab : 'general';

  return (
    <MainLayout title="Settings" subtitle="Configure your organization">
      <Tabs
        value={tab}
        // Radix activates on focus AND on click, so one tab switch fires
        // onValueChange twice in the same task — before React re-renders, so
        // any state/closure guard is stale. window.location updates
        // synchronously with pushState, making it the only reliable dedupe;
        // without it every switch costs two history entries and the back
        // button appears dead.
        onValueChange={(value) => {
          const current =
            new URLSearchParams(window.location.search).get('tab') ?? 'general';
          if (value !== current) setSearchParams({ tab: value });
        }}
        orientation={isMobile ? 'horizontal' : 'vertical'}
        className="space-y-4 md:space-y-0 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-8 md:items-start"
      >
        <TabsList
          className={[
            // Kill the pill-bar chrome from tabsListVariants in both layouts.
            'h-auto p-0 bg-transparent border-0 rounded-none justify-start',
            // Mobile: one scrolling row.
            'flex w-full gap-1 overflow-x-auto',
            // Desktop: sectioned rail, sticky under the app header.
            'md:flex-col md:items-stretch md:gap-0 md:overflow-visible md:sticky md:top-20',
          ].join(' ')}
        >
          {groups.map((group) => (
            <div key={group.heading} className="contents md:block">
              <div
                aria-hidden="true"
                className="hidden md:block px-3 pt-5 pb-1.5 first:pt-0 text-xs font-medium tracking-wide text-muted-foreground/70"
              >
                {group.heading}
              </div>
              <div className="contents md:flex md:flex-col md:gap-0.5">
                {group.tabs.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className={RAIL_TRIGGER_CLASSES}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {label}
                  </TabsTrigger>
                ))}
              </div>
            </div>
          ))}
        </TabsList>

        <TabsContent value="general" className="max-w-2xl md:mt-0">
          <GeneralSettings />
        </TabsContent>

        {isOwner && (
          <TabsContent value="billing" className="max-w-4xl md:mt-0">
            <BillingSettings />
          </TabsContent>
        )}

        <TabsContent value="branding" className="max-w-2xl md:mt-0">
          <BrandingSettings />
        </TabsContent>

        <TabsContent value="notifications" className="max-w-2xl md:mt-0">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="job-types" className="max-w-2xl md:mt-0">
          <JobTypesSettings />
        </TabsContent>

        <TabsContent value="equipment" className="max-w-2xl md:mt-0">
          <EquipmentTypesSettings />
        </TabsContent>

        <TabsContent value="parts" className="max-w-4xl md:mt-0">
          <PartsCatalogSettings />
        </TabsContent>

        <TabsContent value="features" className="max-w-2xl md:mt-0">
          <FeatureSettings />
        </TabsContent>

        <TabsContent value="checklists" className="max-w-4xl md:mt-0">
          <ChecklistTemplateSettings />
        </TabsContent>

        {showWorkflows && (
          <TabsContent value="workflows" className="max-w-4xl md:mt-0">
            <WorkflowTemplateList />
          </TabsContent>
        )}

        <TabsContent value="calendar" className="max-w-2xl md:mt-0">
          <CalendarSettings />
        </TabsContent>

        <TabsContent value="api" className="max-w-4xl md:mt-0">
          <APISettings />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
