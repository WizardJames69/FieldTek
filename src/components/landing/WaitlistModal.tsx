import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getStoredUtmParams, trackEvent } from "@/lib/analytics";

const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  company_name: z.string().optional(),
  technician_count: z.string().optional(),
  industry: z.string().optional(),
});

type WaitlistFormData = z.infer<typeof waitlistSchema>;

interface WaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const teamSizes = [
  { value: "1-5", label: "1-5 technicians" },
  { value: "6-15", label: "6-15 technicians" },
  { value: "16-30", label: "16-30 technicians" },
  { value: "31-50", label: "31-50 technicians" },
  { value: "50+", label: "50+ technicians" },
];

const industries = [
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "appliance", label: "Appliance Repair" },
  { value: "fire_safety", label: "Fire & Safety" },
  { value: "general", label: "General Contracting" },
  { value: "other", label: "Other" },
];

export function WaitlistModal({ open, onOpenChange }: WaitlistModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const autoCloseTimeoutRef = useRef<number | null>(null);

  const form = useForm<WaitlistFormData>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      email: "",
      company_name: "",
      technician_count: undefined,
      industry: undefined,
    },
  });

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimeoutRef.current) {
        window.clearTimeout(autoCloseTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (data: WaitlistFormData) => {
    console.log('[Waitlist] Form data:', {
      email: data.email,
      company: data.company_name,
      teamSize: data.technician_count,
      industry: data.industry,
    });
    setIsSubmitting(true);
    try {
      // Get UTM parameters for attribution tracking
      const utmParams = getStoredUtmParams();
      
      const insertPayload = {
        email: data.email,
        company_name: data.company_name || null,
        technician_count: data.technician_count || null,
        industry: data.industry || null,
        source: "landing_page",
        utm_source: utmParams.utm_source,
        utm_medium: utmParams.utm_medium,
        utm_campaign: utmParams.utm_campaign,
        utm_content: utmParams.utm_content,
      };
      console.log('[Waitlist] Insert payload:', insertPayload);
      
      const { error } = await supabase
        .from("waitlist_signups")
        .insert(insertPayload);

      if (error) {
        if (error.code === "23505") {
          // Show friendly "already on list" state instead of just toast
          console.log('[Waitlist] Already on list:', data.email);
          setIsSuccess(true);
          toast.info("You're already on the waitlist! We'll be in touch soon.");
          setIsSubmitting(false);
          return;
        } else {
          throw error;
        }
      }
      
      console.log('[Waitlist] Insert successful');
      
      // Track the signup event
      trackEvent("waitlist_signup", {
        industry: data.industry || "unknown",
        team_size: data.technician_count || "unknown",
        has_company: !!data.company_name,
        utm_source: utmParams.utm_source || "direct",
      });

      // Send confirmation email (fire and forget)
      supabase.functions
        .invoke("send-waitlist-email", {
          body: {
            email: data.email,
            companyName: data.company_name,
          },
        })
        .catch((err) => console.error("Waitlist email send failed:", err));

      setIsSuccess(true);
      
      // Close modal after showing success (with cleanup tracking)
      autoCloseTimeoutRef.current = window.setTimeout(() => {
        onOpenChange(false);
        // Reset after closing
        window.setTimeout(() => {
          setIsSuccess(false);
          form.reset();
        }, 300);
      }, 4000);
    } catch (error) {
      console.error('[Waitlist] Error:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset state and clear pending timeout when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Clear any pending auto-close timeout
      if (autoCloseTimeoutRef.current) {
        window.clearTimeout(autoCloseTimeoutRef.current);
        autoCloseTimeoutRef.current = null;
      }
      setIsSuccess(false);
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success"
              data-testid="waitlist-success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="py-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4"
              >
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">You're on the list!</h3>
              <p className="text-muted-foreground">
                We'll notify you as soon as we launch. Get ready to transform your field operations.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Join the Waitlist
                </DialogTitle>
                <DialogDescription>
                  Be the first to know when FieldTek launches. Get early access and exclusive offers.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work Email *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="you@company.com" 
                            type="email"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your company" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="technician_count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team Size</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger data-testid="team-size-select">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {teamSizes.map((size) => (
                                <SelectItem 
                                  key={size.value} 
                                  value={size.value}
                                  data-testid={`team-size-${size.value}`}
                                >
                                  {size.label}
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
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger data-testid="industry-select">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {industries.map((industry) => (
                                <SelectItem 
                                  key={industry.value} 
                                  value={industry.value}
                                  data-testid={`industry-${industry.value}`}
                                >
                                  {industry.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => onOpenChange(false)}
                    >
                      Maybe Later
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1" 
                      disabled={isSubmitting}
                      data-testid="waitlist-submit-button"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" data-testid="waitlist-loading" />
                          Joining...
                        </>
                      ) : (
                        "Join Waitlist"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
