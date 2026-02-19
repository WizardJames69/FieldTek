import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Send, CheckCircle } from 'lucide-react';
import { useState, useRef } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { supabase } from '@/integrations/supabase/client';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Use environment variable for Turnstile site key - allows rotation without code changes
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().min(10, 'Please provide more details').max(2000, 'Description must be less than 2000 characters'),
  request_type: z.string().min(1, 'Request type is required').max(50, 'Request type too long'),
  contact_name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  contact_email: z.string().email('Invalid email').max(255, 'Email must be less than 255 characters'),
  contact_phone: z.string().max(20, 'Phone number too long').optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ServiceRequestFormProps {
  tenantId: string;
  tenantName?: string;
}

const REQUEST_TYPES = [
  'Repair',
  'Maintenance',
  'Installation',
  'Inspection',
  'Emergency',
  'Quote Request',
  'Other',
];

export function ServiceRequestForm({ tenantId, tenantName }: ServiceRequestFormProps) {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      request_type: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!turnstileToken) {
        throw new Error('Please complete the CAPTCHA verification');
      }

      const { data: result, error } = await supabase.functions.invoke('verify-turnstile', {
        body: {
          token: turnstileToken,
          formData: data,
          tenantId,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      
      return result;
    },
    onSuccess: () => {
      setSubmitted(true);
      setTurnstileToken(null);
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

  if (submitted) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Request Submitted!</h2>
        <p className="text-muted-foreground">
          Thank you for your request. We'll be in touch soon.
        </p>
        <Button className="mt-6" onClick={handleSubmitAnother}>
          Submit Another Request
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => submitMutation.mutate(data))} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="contact_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Smith" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contact_email"
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
          name="contact_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="(555) 123-4567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                <Input placeholder="Brief description of your request" {...field} />
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
                  placeholder="Please provide as much detail as possible about your request..."
                  rows={5}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Turnstile CAPTCHA */}
        {TURNSTILE_SITE_KEY && (
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
        )}

        <Button 
          type="submit" 
          className="w-full" 
          disabled={submitMutation.isPending || (TURNSTILE_SITE_KEY && !turnstileToken)}
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
  );
}
