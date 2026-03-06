import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, FlaskConical, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  { value: "elevator", label: "Elevator" },
  { value: "appliance", label: "Appliance Repair/Install" },
  { value: "fire_safety", label: "Fire & Safety" },
  { value: "other", label: "Other" },
];

const inputClass =
  "w-full h-11 rounded-xl bg-[#161819] border border-white/[0.06] text-white placeholder:text-[#4B5563] px-3 text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition-colors";

const selectClass =
  "w-full h-11 rounded-xl bg-[#161819] border border-white/[0.06] text-white px-3 text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition-colors appearance-none cursor-pointer";

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

  useEffect(() => {
    return () => {
      if (autoCloseTimeoutRef.current) {
        window.clearTimeout(autoCloseTimeoutRef.current);
      }
    };
  }, []);

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

      notifyNewBetaApplication({
        email: data.email,
        companyName: data.company_name,
        industry: data.industry,
        teamSize: data.technician_count,
      });

      setIsSuccess(true);

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
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] max-h-[90vh] overflow-y-auto bg-[#111214] border border-white/[0.06] rounded-2xl p-8 md:p-10 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm text-[#6B7280] transition-colors hover:text-white focus:outline-none" aria-label="Close dialog">
            <X className="h-4 w-4" aria-hidden="true" />
          </DialogPrimitive.Close>

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
                  className="mx-auto w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-4"
                >
                  <CheckCircle2 className="h-8 w-8 text-orange-500" />
                </motion.div>
                <h3 className="text-xl font-semibold text-white mb-2">Application Received!</h3>
                <p className="text-[#9CA3AF] mb-4">
                  We'll review your application and get back to you within 48 hours.
                </p>
                <p className="text-sm text-[#9CA3AF]">
                  Once approved, you'll receive your exclusive <span className="text-orange-500 font-semibold">50% discount code</span>.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex flex-col space-y-1.5 mb-6">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-orange-500" />
                    <h2 className="text-2xl font-semibold text-white">Apply for Beta Access</h2>
                  </div>
                  <p className="text-[15px] text-[#9CA3AF]">
                    Help shape FieldTek and get <span className="text-orange-500 font-semibold">50% off</span> your first year subscription.
                  </p>
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-zinc-300">Work Email *</FormLabel>
                          <FormControl>
                            <input
                              type="email"
                              placeholder="you@company.com"
                              className={inputClass}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="company_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-zinc-300">Company Name *</FormLabel>
                          <FormControl>
                            <input
                              type="text"
                              placeholder="Your company"
                              className={inputClass}
                              {...field}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="technician_count"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-zinc-300">Team Size *</FormLabel>
                            <FormControl>
                              <select
                                value={field.value || ""}
                                onChange={field.onChange}
                                className={selectClass}
                              >
                                <option value="" disabled className="bg-[#161819] text-[#4B5563]">Select</option>
                                {teamSizes.map((size) => (
                                  <option key={size.value} value={size.value} className="bg-[#161819] text-white">
                                    {size.label}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="industry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-zinc-300">Industry *</FormLabel>
                            <FormControl>
                              <select
                                value={field.value || ""}
                                onChange={field.onChange}
                                className={selectClass}
                              >
                                <option value="" disabled className="bg-[#161819] text-[#4B5563]">Select</option>
                                {industries.map((industry) => (
                                  <option key={industry.value} value={industry.value} className="bg-[#161819] text-white">
                                    {industry.label}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="interest_reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-zinc-300">Why do you want to be a beta tester? *</FormLabel>
                          <FormControl>
                            <textarea
                              placeholder="Tell us about your current challenges and what features you're most excited about..."
                              className={`${inputClass} h-auto min-h-[100px] py-2.5 resize-none`}
                              onKeyDown={(e) => e.stopPropagation()}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="terms_accepted"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border border-white/[0.06] p-4 bg-[#161819]">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="border-white/[0.12] data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-normal text-[#9CA3AF] cursor-pointer">
                              I agree to provide feedback during the beta period and understand that features may change before the final release.
                            </FormLabel>
                            <FormMessage className="text-red-400" />
                          </div>
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        className="flex-1 h-11 rounded-xl bg-transparent border border-white/[0.12] text-white text-sm font-medium hover:bg-white/5 transition-colors"
                        onClick={() => onOpenChange(false)}
                      >
                        Maybe Later
                      </button>
                      <Button
                        type="submit"
                        className="flex-1 h-11 rounded-xl bg-orange-500 hover:bg-[#EA580C] text-white font-semibold border-0 cta-glow"
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
