import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, FlaskConical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { trackEvent } from "@/lib/analytics";
import { notifyNewBetaApplication } from "@/lib/pushNotifications";

const betaTesterSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  company_name: z.string().min(2, "Company name is required"),
  industry: z.string().min(1, "Please select an industry"),
  technician_count: z.string().min(1, "Please select team size"),
  interest_reason: z.string().min(20, "Please tell us why you want to join (at least 20 characters)"),
  terms_accepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms" }),
  }),
});

type BetaTesterFormData = z.infer<typeof betaTesterSchema>;

interface BetaTesterModalProps {
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

export function BetaTesterModal({ open, onOpenChange }: BetaTesterModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const autoCloseTimeoutRef = useRef<number | null>(null);

  const form = useForm<BetaTesterFormData>({
    resolver: zodResolver(betaTesterSchema),
    defaultValues: {
      email: "",
      company_name: "",
      industry: undefined,
      technician_count: undefined,
      interest_reason: "",
      terms_accepted: undefined,
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

  // Track when modal opens
  useEffect(() => {
    if (open) {
      trackEvent("beta_application_started", {});
    }
  }, [open]);

  const handleSubmit = async (data: BetaTesterFormData) => {
    console.log('[BetaTester] Form data:', {
      email: data.email,
      company: data.company_name,
      teamSize: data.technician_count,
      industry: data.industry,
    });
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from("beta_applications")
        .insert({
          email: data.email,
          company_name: data.company_name,
          industry: data.industry,
          technician_count: data.technician_count,
          interest_reason: data.interest_reason,
          status: "pending",
        });

      if (error) {
        if (error.code === "23505") {
          console.log('[BetaTester] Already applied:', data.email);
          setIsSuccess(true);
          toast.info("You've already applied! We'll be in touch soon.");
          setIsSubmitting(false);
          return;
        } else {
          throw error;
        }
      }
      
      console.log('[BetaTester] Application submitted successfully');
      
      trackEvent("beta_application_submitted", {
        industry: data.industry,
        team_size: data.technician_count,
      });

      // Notify platform admins about the new application (fire and forget)
      notifyNewBetaApplication({
        email: data.email,
        companyName: data.company_name,
        industry: data.industry,
        teamSize: data.technician_count,
      });

      setIsSuccess(true);
      
      // Close modal after showing success
      autoCloseTimeoutRef.current = window.setTimeout(() => {
        onOpenChange(false);
        window.setTimeout(() => {
          setIsSuccess(false);
          form.reset();
        }, 300);
      }, 5000);
    } catch (error) {
      console.error('[BetaTester] Error:', error);
      trackEvent("beta_application_error", {});
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success"
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
              <h3 className="text-xl font-semibold mb-2">Application Received!</h3>
              <p className="text-muted-foreground mb-4">
                We'll review your application and get back to you within 48 hours.
              </p>
              <p className="text-sm text-muted-foreground">
                Once approved, you'll receive your exclusive <span className="text-primary font-semibold">50% discount code</span>.
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
                  <FlaskConical className="h-5 w-5 text-primary" />
                  Apply for Beta Access
                </DialogTitle>
                <DialogDescription>
                  Help shape FieldTek and get <span className="text-primary font-semibold">50% off</span> your first year subscription.
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
                        <FormLabel>Company Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Your company" 
                            {...field}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
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
                          <FormLabel>Team Size *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {teamSizes.map((size) => (
                                <SelectItem key={size.value} value={size.value}>
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
                          <FormLabel>Industry *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {industries.map((industry) => (
                                <SelectItem key={industry.value} value={industry.value}>
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

                  <FormField
                    control={form.control}
                    name="interest_reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Why do you want to be a beta tester? *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Tell us about your current challenges and what features you're most excited about..."
                            className="min-h-[100px] resize-none"
                            onKeyDown={(e) => e.stopPropagation()}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="terms_accepted"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border p-4 bg-muted/30">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal cursor-pointer">
                            I agree to provide feedback during the beta period and understand that features may change before the final release.
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

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
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Apply Now"
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
