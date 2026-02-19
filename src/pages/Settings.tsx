import { useSearchParams } from 'react-router-dom';
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
import { APISettings } from '@/components/settings/APISettings';
import { CalendarSettings } from '@/components/settings/CalendarSettings';
import { useUserRole } from '@/contexts/TenantContext';

export default function Settings() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'general';
  const { isOwner } = useUserRole();
  return (
    <MainLayout title="Settings" subtitle="Configure your organization">
      <Tabs defaultValue={defaultTab} className="space-y-4 md:space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1.5 w-full overflow-x-auto bg-muted/60 backdrop-blur-sm">
          <TabsTrigger value="general" className="text-xs md:text-sm touch-native">General</TabsTrigger>
          {isOwner && <TabsTrigger value="billing" className="text-xs md:text-sm touch-native">Billing</TabsTrigger>}
          <TabsTrigger value="branding" className="text-xs md:text-sm touch-native">Branding</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs md:text-sm touch-native">Notifications</TabsTrigger>
          <TabsTrigger value="job-types" className="text-xs md:text-sm touch-native">Job Types</TabsTrigger>
          <TabsTrigger value="equipment" className="text-xs md:text-sm touch-native">Equipment</TabsTrigger>
          <TabsTrigger value="parts" className="text-xs md:text-sm touch-native">Parts</TabsTrigger>
          <TabsTrigger value="features" className="text-xs md:text-sm touch-native">Features</TabsTrigger>
          <TabsTrigger value="checklists" className="text-xs md:text-sm touch-native">Checklists</TabsTrigger>
          <TabsTrigger value="calendar" className="text-xs md:text-sm touch-native">Calendar</TabsTrigger>
          <TabsTrigger value="api" className="text-xs md:text-sm touch-native">API</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="max-w-2xl">
          <GeneralSettings />
        </TabsContent>

        {isOwner && (
          <TabsContent value="billing" className="max-w-4xl">
            <BillingSettings />
          </TabsContent>
        )}

        <TabsContent value="branding" className="max-w-2xl">
          <BrandingSettings />
        </TabsContent>

        <TabsContent value="notifications" className="max-w-2xl">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="job-types" className="max-w-2xl">
          <JobTypesSettings />
        </TabsContent>

        <TabsContent value="equipment" className="max-w-2xl">
          <EquipmentTypesSettings />
        </TabsContent>

        <TabsContent value="parts" className="max-w-4xl">
          <PartsCatalogSettings />
        </TabsContent>

        <TabsContent value="features" className="max-w-2xl">
          <FeatureSettings />
        </TabsContent>

        <TabsContent value="checklists" className="max-w-4xl">
          <ChecklistTemplateSettings />
        </TabsContent>

        <TabsContent value="calendar" className="max-w-2xl">
          <CalendarSettings />
        </TabsContent>

        <TabsContent value="api" className="max-w-4xl">
          <APISettings />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}