import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, X, Globe, Pipette, Check, Palette } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useBranding } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const formSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
});

type FormData = z.infer<typeof formSchema>;

export function BrandingSettings() {
  const { tenant, refreshTenant } = useTenant();
  const branding = useBranding();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(branding.logo_url || null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(branding.favicon_url || null);
  const [colorsApplied, setColorsApplied] = useState(false);
  const [isApplyingColors, setIsApplyingColors] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: branding.companyName || '',
      primary_color: branding.primary_color || '#3b82f6',
      secondary_color: branding.secondary_color || '#10b981',
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!tenant?.id) throw new Error('No tenant');

      let logoUrl = branding.logo_url;
      let faviconUrl = branding.favicon_url;

      // Upload logo if changed - use public branding bucket
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${tenant.id}/logo.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('branding')
          .upload(fileName, logoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('branding')
          .getPublicUrl(fileName);

        logoUrl = urlData.publicUrl;
      }

      // Upload favicon if changed - use public branding bucket
      if (faviconFile) {
        const fileExt = faviconFile.name.split('.').pop();
        const fileName = `${tenant.id}/favicon.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('branding')
          .upload(fileName, faviconFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('branding')
          .getPublicUrl(fileName);

        faviconUrl = urlData.publicUrl;
      }

      // Update tenant name
      await supabase
        .from('tenants')
        .update({ name: data.company_name })
        .eq('id', tenant.id);

      // Check if branding exists, then update or insert
      const { data: existingBranding } = await supabase
        .from('tenant_branding')
        .select('id')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (existingBranding) {
        // Update existing branding
        const { error } = await supabase
          .from('tenant_branding')
          .update({
            logo_url: logoUrl,
            favicon_url: faviconUrl,
            primary_color: data.primary_color,
            secondary_color: data.secondary_color,
            company_name: data.company_name,
          })
          .eq('tenant_id', tenant.id);

        if (error) throw error;
      } else {
        // Insert new branding
        const { error } = await supabase
          .from('tenant_branding')
          .insert({
            tenant_id: tenant.id,
            logo_url: logoUrl,
            favicon_url: faviconUrl,
            primary_color: data.primary_color,
            secondary_color: data.secondary_color,
            company_name: data.company_name,
          });

        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast({ title: 'Branding updated' });
      setIsApplyingColors(true);
      await refreshTenant();
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      setLogoFile(null);
      setFaviconFile(null);
      // Show "applied" state briefly
      setTimeout(() => {
        setIsApplyingColors(false);
        setColorsApplied(true);
        setTimeout(() => setColorsApplied(false), 2000);
      }, 500);
    },
    onError: (error) => {
      toast({
        title: 'Failed to save',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFaviconFile(file);
      setFaviconPreview(URL.createObjectURL(file));
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const removeFavicon = () => {
    setFaviconFile(null);
    setFaviconPreview(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Branding</CardTitle>
            <CardDescription>
              Customize your company's appearance across the platform
            </CardDescription>
          </div>
          {/* Color application status indicator */}
          {(isApplyingColors || colorsApplied) && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
              colorsApplied 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                : 'bg-primary/10 text-primary'
            }`}>
              {isApplyingColors ? (
                <>
                  <Palette className="h-4 w-4 animate-pulse" />
                  <span>Applying colors...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Colors applied!</span>
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
            {/* Logo Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Company Logo</label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-16 w-auto max-w-[200px] object-contain rounded border"
                    />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute -top-2 -right-2 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center w-32 h-16 border-2 border-dashed rounded cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Upload className="h-5 w-5" />
                      <span className="text-xs mt-1">Upload</span>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoChange}
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: 200x50px PNG or SVG
              </p>
            </div>

            {/* Favicon Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Favicon</label>
              <div className="flex items-center gap-4">
                {faviconPreview ? (
                  <div className="relative">
                    <img
                      src={faviconPreview}
                      alt="Favicon preview"
                      className="h-10 w-10 object-contain rounded border bg-muted"
                    />
                    <button
                      type="button"
                      onClick={removeFavicon}
                      className="absolute -top-2 -right-2 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center w-16 h-16 border-2 border-dashed rounded cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Globe className="h-5 w-5" />
                      <span className="text-xs mt-1">Upload</span>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/png,image/x-icon,image/svg+xml,.ico"
                      onChange={handleFaviconChange}
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: 32x32px or 64x64px PNG, ICO, or SVG
              </p>
            </div>

            <FormField
              control={form.control}
              name="company_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="primary_color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Color</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-10"
                        >
                          <div
                            className="w-5 h-5 rounded border"
                            style={{ backgroundColor: field.value }}
                          />
                          <span className="font-mono text-sm">{field.value}</span>
                          <Pipette className="h-4 w-4 ml-auto text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3" align="start">
                        <div className="space-y-3">
                          <Input
                            type="color"
                            value={field.value}
                            onChange={field.onChange}
                            className="w-full h-32 p-1 cursor-pointer"
                          />
                          <Input
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="#000000"
                            className="font-mono"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="secondary_color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secondary Color</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-10"
                        >
                          <div
                            className="w-5 h-5 rounded border"
                            style={{ backgroundColor: field.value }}
                          />
                          <span className="font-mono text-sm">{field.value}</span>
                          <Pipette className="h-4 w-4 ml-auto text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3" align="start">
                        <div className="space-y-3">
                          <Input
                            type="color"
                            value={field.value}
                            onChange={field.onChange}
                            className="w-full h-32 p-1 cursor-pointer"
                          />
                          <Input
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="#000000"
                            className="font-mono"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Branding
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
