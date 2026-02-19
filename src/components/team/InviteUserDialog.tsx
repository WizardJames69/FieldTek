import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { UserPlus, Mail, Shield, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['admin', 'dispatcher', 'technician', 'client'] as const),
});

type FormValues = z.infer<typeof formSchema>;

const roleDescriptions: Record<string, string> = {
  admin: 'Full access to all features and settings',
  dispatcher: 'Manage jobs, schedule, and clients',
  technician: 'View assigned jobs and complete work',
  client: 'View their own service requests and history',
};

interface InviteUserDialogProps {
  onInviteSent: () => void;
}

export function InviteUserDialog({ onInviteSent }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { user } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      role: 'technician',
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!tenant?.id || !user?.id) {
      toast({
        title: 'Error',
        description: 'Unable to send invitation. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Call the edge function to send invitation email
      console.log('Sending team invitation to:', values.email, 'role:', values.role, 'tenant:', tenant.id);
      
      const { data, error } = await supabase.functions.invoke('send-team-invitation', {
        body: {
          email: values.email,
          role: values.role,
          tenantId: tenant.id,
        },
      });

      console.log('Invitation response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('Invitation error from function:', data.error);
        throw new Error(data.error);
      }

      toast({
        title: 'Invitation sent!',
        description: `An invitation email has been sent to ${values.email}`,
      });
      form.reset();
      setOpen(false);
      onInviteSent();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      
      // Handle specific error messages
      if (error.message?.includes('permission')) {
        toast({
          title: 'Permission denied',
          description: 'You do not have permission to invite team members.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Failed to send invitation',
          description: error.message || 'Please try again later.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Team Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="team@example.com"
                        className="pl-9"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <Shield className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="dispatcher">Dispatcher</SelectItem>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {roleDescriptions[field.value]}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Invitation'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}