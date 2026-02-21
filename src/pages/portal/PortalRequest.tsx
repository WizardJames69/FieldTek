import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, CheckCircle, Clock, AlertCircle, Wrench } from 'lucide-react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { supabase } from '@/integrations/supabase/client';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { PortalAuthGuard } from '@/components/portal/PortalAuthGuard';

const TURNSTILE_SITE_KEY = '0x4AAAAAACLKrGrtiojgEh1t';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().min(10, 'Please provide more details (at least 10 characters)').max(2000, 'Description must be less than 2000 characters'),
  request_type: z.string().min(1, 'Request type is required').max(50, 'Request type too long'),
});

type FormData = z.infer<typeof formSchema>;

const REQUEST_TYPES = [
  'Repair',
  'Maintenance',
  'Installation',
  'Inspection',
  'Emergency',
  'Quote Request',
  'Other',
];

export default function PortalRequest() {
  const { client, loading: authLoading, user } = usePortalAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Extract equipment details from URL params
  const equipmentId = searchParams.get('equipment_id');
  const equipmentType = searchParams.get('equipment_type');
  const equipmentBrand = searchParams.get('brand');
  const equipmentModel = searchParams.get('model');
  const equipmentSerial = searchParams.get('serial');

  const hasEquipmentContext = !!(equipmentId && equipmentType);
  const equipmentLabel = hasEquipmentContext 
    ? `${equipmentType}${equipmentBrand ? ` - ${equipmentBrand}` : ''}${equipmentModel ? ` ${equipmentModel}` : ''}`
    : null;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      request_type: '',
    },
  });

  // Pre-fill form when equipment context is provided
  useEffect(() => {
    if (hasEquipmentContext) {
      const titlePrefix = `Service for ${equipmentType}`;
      const descriptionPrefix = [
        `Equipment: ${equipmentType}`,
        equipmentBrand && `Brand: ${equipmentBrand}`,
        equipmentModel && `Model: ${equipmentModel}`,
        equipmentSerial && `Serial: ${equipmentSerial}`,
        '',
        'Please describe the issue:',
        '',
      ].filter(Boolean).join('\n');

      form.setValue('title', titlePrefix);
      form.setValue('description', descriptionPrefix);
      form.setValue('request_type', 'Repair');
    }
  }, [hasEquipmentContext, equipmentType, equipmentBrand, equipmentModel, equipmentSerial, form]);

  // Fetch existing requests
  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['portal-requests', client?.id, client?.tenant_id],
    queryFn: async () => {
      if (!client?.id || !client?.tenant_id) return [];

      const { data } = await supabase
        .from('service_requests')
        .select('id, title, description, request_type, status, priority, created_at')
        .eq('client_id', client.id)
        .eq('tenant_id', client.tenant_id)
        .order('created_at', { ascending: false })
        .limit(10);

      return data || [];
    },
    enabled: !!client?.id && !!client?.tenant_id,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!client) throw new Error('Your session has expired. Please sign in again.');
      if (!turnstileToken) throw new Error('Please complete the CAPTCHA verification');

      // Use the edge function for CAPTCHA verification and rate limiting
      const { data: result, error } = await supabase.functions.invoke('verify-turnstile-portal', {
        body: {
          token: turnstileToken,
          formData: data,
          tenantId: client.tenant_id,
          clientId: client.id,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      
      return result;
    },
    onSuccess: () => {
      setSubmitted(true);
      setTurnstileToken(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['portal-requests', client?.id] });
    },
    onError: (error) => {
      // Reset Turnstile on error
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      
      toast({
        title: 'Submission failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmitAnother = () => {
    setSubmitted(false);
    form.reset();
    turnstileRef.current?.reset();
    setTurnstileToken(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      new: { variant: 'secondary', icon: Clock },
      reviewing: { variant: 'default', icon: AlertCircle },
      approved: { variant: 'outline', icon: CheckCircle },
      rejected: { variant: 'destructive', icon: AlertCircle },
      converted: { variant: 'outline', icon: CheckCircle },
    };
    const config = variants[status] || { variant: 'secondary', icon: Clock };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="capitalize">
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  // Auth guard handled by PortalAuthGuard wrapper

  return (
    <PortalAuthGuard>
    <PortalLayout>
      <div className="space-y-6">
        <div className="page-header-glass rounded-xl p-4 md:p-6 bg-background/60 backdrop-blur-xl border border-border/30">
          <h1 className="text-2xl font-bold font-display">Service Request</h1>
          <p className="text-muted-foreground">Submit a new service request or view your existing requests</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Submit New Request */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="font-display">New Request</CardTitle>
              <CardDescription>
                Describe the service you need and we'll get back to you shortly
              </CardDescription>
              {equipmentLabel && (
                <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Wrench className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <span className="font-medium">Request for:</span>
                      <span className="text-muted-foreground ml-1">{equipmentLabel}</span>
                    </div>
                  </div>
                  {equipmentSerial && (
                    <p className="text-xs text-muted-foreground mt-1 ml-10">
                      Serial: <span className="font-mono">{equipmentSerial}</span>
                    </p>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="text-center py-8" data-testid="portal-request-success">
                  <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Request Submitted!</h3>
                  <p className="text-muted-foreground mb-6">
                    We've received your request and will be in touch soon.
                  </p>
                  <Button onClick={handleSubmitAnother}>
                    Submit Another Request
                  </Button>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => submitMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="request_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Request Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {REQUEST_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject</FormLabel>
                          <FormControl>
                            <Input placeholder="Brief description of your request" {...field} data-testid="portal-request-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Details</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Please provide as much detail as possible..."
                              rows={5}
                              {...field}
                              data-testid="portal-request-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Turnstile CAPTCHA */}
                    <div className="flex justify-center">
                      <Turnstile
                        ref={turnstileRef}
                        siteKey={TURNSTILE_SITE_KEY}
                        onSuccess={(token) => setTurnstileToken(token)}
                        onError={() => {
                          setTurnstileToken(null);
                          toast({
                            title: 'CAPTCHA Error',
                            description: 'Failed to load CAPTCHA. Please refresh the page.',
                            variant: 'destructive',
                          });
                        }}
                        onExpire={() => setTurnstileToken(null)}
                        options={{
                          theme: 'auto',
                        }}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full btn-shimmer touch-native"
                      disabled={submitMutation.isPending || !turnstileToken}
                      data-testid="portal-request-submit"
                    >
                      {submitMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Submit Request
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>

          {/* Recent Requests */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="font-display">Recent Requests</CardTitle>
              <CardDescription>
                Track the status of your service requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : requests?.length === 0 ? (
                <div className="text-center py-8 empty-state-native">
                  <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">No requests submitted yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests?.map(request => (
                    <div
                      key={request.id}
                      className="list-item-native p-3 rounded-lg border border-border/50 bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm line-clamp-1">{request.title}</h4>
                        {getStatusBadge(request.status || 'new')}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {request.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="px-2 py-0.5 rounded-full bg-muted/50">{request.request_type}</span>
                        <span>{format(new Date(request.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
    </PortalAuthGuard>
  );
}
