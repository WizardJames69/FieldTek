import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Phone, Mail, MapPin, Bell, BellOff, Save, Loader2, Key } from 'lucide-react';
import { PortalLayout as Layout } from '@/components/portal/PortalLayout';
import { PortalAuthGuard } from '@/components/portal/PortalAuthGuard';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Password must be at least 6 characters'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

interface ClientDetails {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
}

interface NotificationPreferences {
  email_job_updates: boolean;
  email_invoice_reminders: boolean;
  email_marketing: boolean;
}

export default function PortalProfile() {
  const { user, client, loading: authLoading, clientLoading, refreshClient } = usePortalAuth();
  const { toast } = useToast();
  const [clientDetails, setClientDetails] = useState<ClientDetails | null>(null);
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    email_job_updates: true,
    email_invoice_reminders: true,
    email_marketing: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    const fetchClientDetails = async () => {
      if (!client?.id) return;

      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('id', client.id)
          .single();

        if (error) throw error;

        setClientDetails(data);
        form.reset({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          zip_code: data.zip_code || '',
        });

        // Load notification preferences from notes (stored as JSON)
        if (data.notes) {
          try {
            const notesData = JSON.parse(data.notes);
            if (notesData.notification_preferences) {
              setNotifications(notesData.notification_preferences);
            }
          } catch {
            // Notes is not JSON, ignore
          }
        }
      } catch (error) {
        console.error('Error fetching client details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClientDetails();
  }, [client?.id, form]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!client?.id) return;

    setSaving(true);
    try {
      // Prepare notes with notification preferences
      const notesData = {
        notification_preferences: notifications,
      };

      const { error } = await supabase
        .from('clients')
        .update({
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          zip_code: data.zip_code || null,
          notes: JSON.stringify(notesData),
        })
        .eq('id', client.id);

      if (error) throw error;

      toast({
        title: 'Profile updated',
        description: 'Your contact information has been saved.',
      });

      // Refresh client data in context
      refreshClient?.();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setSavingPassword(true);
    try {
      // Verify current password first
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: data.currentPassword,
      });

      if (verifyError) {
        throw new Error('Current password is incorrect');
      }

      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) throw error;

      toast({
        title: 'Password updated',
        description: 'Your password has been changed successfully.',
      });

      setPasswordDialogOpen(false);
      passwordForm.reset();
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update password.',
        variant: 'destructive',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!client) {
    return (
      <PortalAuthGuard>
      <Layout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <User className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Profile Found</h2>
          <p className="text-muted-foreground mb-4">
            This account doesn't have a customer profile linked to it.
          </p>
          <Button variant="outline" onClick={() => window.location.href = '/portal/login'}>
            Back to Login
          </Button>
        </div>
      </Layout>
      </PortalAuthGuard>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <PortalAuthGuard>
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header-glass rounded-xl p-4 md:p-6 bg-background/60 backdrop-blur-xl border border-border/30">
          <h1 className="text-2xl font-bold font-display text-foreground">My Profile</h1>
          <p className="text-muted-foreground">Manage your contact information and preferences</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Summary Card */}
          <Card variant="glass" className="lg:col-span-1">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <Avatar className="h-24 w-24 mb-4 ring-4 ring-primary/20 ring-offset-2 ring-offset-background">
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-2xl font-display">
                      {client?.name ? getInitials(client.name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online indicator */}
                  <div className="absolute bottom-4 right-0 w-4 h-4 rounded-full bg-success border-2 border-background shadow-[0_0_8px_hsl(var(--success)/0.5)]" />
                </div>
                <h2 className="text-xl font-semibold font-display">{client?.name}</h2>
                <p className="text-muted-foreground">{client?.email}</p>
                {client?.phone && (
                  <p className="text-sm text-muted-foreground mt-1">{client.phone}</p>
                )}
                <p className="text-xs text-muted-foreground mt-3 bg-muted/50 backdrop-blur-sm px-3 py-1 rounded-full border border-border/50">
                  {client?.tenant_name} Customer
                </p>
              </div>

              <Separator className="my-6 bg-border/50" />

              {/* Change Password */}
              <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full touch-native hover:border-primary/30 hover:bg-primary/5 transition-all">
                    <Key className="h-4 w-4 mr-2" />
                    Change Password
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-surface">
                  <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>
                      Verify your identity and enter your new password.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                      <FormField
                        control={passwordForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={savingPassword}>
                          {savingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Update Password
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Contact Information Form */}
          <Card variant="glass" className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                Contact Information
              </CardTitle>
              <CardDescription>
                Update your contact details so we can reach you about your service appointments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator className="my-4" />

                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <MapPin className="h-4 w-4" />
                      Service Address
                    </div>

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 sm:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="City" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State / Province</FormLabel>
                            <FormControl>
                              <Input placeholder="State / Province" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="zip_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ZIP / Postal Code</FormLabel>
                            <FormControl>
                              <Input placeholder="12345" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button type="submit" disabled={saving}>
                        {saving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose what updates you'd like to receive from us.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Job Updates</label>
                    <p className="text-sm text-muted-foreground">
                      Receive email notifications when your job status changes
                    </p>
                  </div>
                  <Switch
                    checked={notifications.email_job_updates}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, email_job_updates: checked }))
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Invoice Reminders</label>
                    <p className="text-sm text-muted-foreground">
                      Get reminded about upcoming and overdue invoices
                    </p>
                  </div>
                  <Switch
                    checked={notifications.email_invoice_reminders}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, email_invoice_reminders: checked }))
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Marketing & Tips</label>
                    <p className="text-sm text-muted-foreground">
                      Seasonal maintenance tips and special offers
                    </p>
                  </div>
                  <Switch
                    checked={notifications.email_marketing}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, email_marketing: checked }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
    </PortalAuthGuard>
  );
}
