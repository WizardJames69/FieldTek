import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  ArrowRight, 
  CalendarIcon, 
  CheckCircle2, 
  User,
  Building,
  Calendar as CalendarIconOutline,
  Loader2
} from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";
const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  company_name: z.string().min(2, "Company name is required"),
  industry: z.string().min(1, "Please select an industry"),
  team_size: z.string().min(1, "Please select team size"),
  preferred_date: z.date().optional(),
  preferred_time: z.string().optional(),
  message: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const industries = [
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "mechanical", label: "Mechanical" },
  { value: "general", label: "General Contracting" },
  { value: "other", label: "Other" },
];

const teamSizes = [
  { value: "1-5", label: "1-5 employees" },
  { value: "6-15", label: "6-15 employees" },
  { value: "16-50", label: "16-50 employees" },
  { value: "51-100", label: "51-100 employees" },
  { value: "100+", label: "100+ employees" },
];

const timeSlots = [
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
];

export default function BookDemo() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company_name: "",
      industry: "",
      team_size: "",
      message: "",
    },
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = form;
  const selectedDate = watch("preferred_date");

  const onSubmit = async (data: FormData) => {
    console.log('[BookDemo] Submitting demo request:', {
      email: data.email,
      company: data.company_name,
      date: data.preferred_date,
      time: data.preferred_time
    });
    setIsSubmitting(true);
    
    try {
      // First check rate limit via edge function (before DB insert)
      const { data: funcData, error: funcError } = await supabase.functions.invoke("notify-demo-request", {
        body: {
          ...data,
          preferred_date: data.preferred_date ? format(data.preferred_date, "yyyy-MM-dd") : null,
        },
      });
      
      // Check for rate limit error (HTTP 429)
      if (funcError) {
        console.error('[BookDemo] Edge function error:', funcError);
        
        // Check if it's a rate limit error
        if (funcError.message?.includes('Rate limit') || funcError.message?.includes('429')) {
          toast.error("You've reached the maximum demo requests for today. Please try again tomorrow.");
          return;
        }
        
        throw funcError;
      }
      
      // Check for rate limit in response
      if (funcData?.rateLimited) {
        console.log('[BookDemo] Rate limited:', funcData.message);
        toast.error(funcData.message || "Too many requests. Please try again tomorrow.");
        return;
      }
      
      console.log('[BookDemo] Notification sent:', funcData);

      // Now save to database
      const { error } = await supabase.from("demo_requests").insert({
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        company_name: data.company_name,
        industry: data.industry,
        team_size: data.team_size,
        preferred_date: data.preferred_date ? format(data.preferred_date, "yyyy-MM-dd") : null,
        preferred_time: data.preferred_time || null,
        message: data.message || null,
      });

      if (error) {
        console.error('[BookDemo] Database insert failed:', error);
        throw error;
      }
      
      console.log('[BookDemo] Database insert successful');
      console.log('[BookDemo] Moving to success step');
      toast.success("Demo request submitted! We'll be in touch soon.");
      setStep(4);
    } catch (error: any) {
      console.error('[BookDemo] Submission failed:', error);
      
      // Handle rate limit from FunctionsHttpError
      if (error?.context?.status === 429) {
        toast.error("You've reached the maximum demo requests for today. Please try again tomorrow.");
        return;
      }
      
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = async () => {
    let isValid = false;
    
    if (step === 1) {
      isValid = await form.trigger(["name", "email", "phone"]);
    } else if (step === 2) {
      isValid = await form.trigger(["company_name", "industry", "team_size"]);
    }
    
    if (isValid) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const steps = [
    { number: 1, title: "Contact Info", icon: User },
    { number: 2, title: "Company Details", icon: Building },
    { number: 3, title: "Schedule Call", icon: CalendarIconOutline },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <Helmet>
        <title>Schedule a Consultation — FieldTek AI</title>
        <meta name="description" content="Book a free consultation with FieldTek AI. Get personalized guidance on how AI-powered field service management can transform your trade business." />
        <link rel="canonical" href="https://fieldtek.ai/consultation" />
        <meta property="og:title" content="Schedule a Consultation — FieldTek AI" />
        <meta property="og:description" content="Book a free consultation to see how FieldTek AI can transform your field service operations." />
        <meta property="og:url" content="https://fieldtek.ai/consultation" />
      </Helmet>
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="lg" />
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Progress Steps */}
          {step < 4 && (
            <div className="mb-12">
              <div className="flex items-center justify-between relative">
                {steps.map((s, index) => (
                  <div key={s.number} className="flex flex-col items-center relative z-10">
                    <div 
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                        step >= s.number 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {step > s.number ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <s.icon className="h-5 w-5" />
                      )}
                    </div>
                    <span className={cn(
                      "mt-2 text-sm font-medium",
                      step >= s.number ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {s.title}
                    </span>
                  </div>
                ))}
                {/* Progress Line */}
                <div className="absolute top-6 left-0 right-0 h-0.5 bg-muted -z-0">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Card */}
          <div className="bg-card border border-border rounded-xl shadow-lg p-8">
            {step < 4 && (
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Schedule a Consultation
                </h1>
                <p className="text-muted-foreground">
                  Have questions after exploring FieldTek? Talk to our team for personalized guidance.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Step 1: Contact Info */}
              {step === 1 && (
                <div className="space-y-6" data-testid="demo-step1">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      placeholder="John Smith"
                      {...register("name")}
                      data-testid="demo-name-input"
                      className={errors.name ? "border-destructive" : ""}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive" data-testid="demo-error-name">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Work Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@company.com"
                      {...register("email")}
                      data-testid="demo-email-input"
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive" data-testid="demo-error-email">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number (Optional)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      {...register("phone")}
                      data-testid="demo-phone-input"
                    />
                  </div>

                  <Button type="button" onClick={nextStep} className="w-full" size="lg" data-testid="demo-step1-continue">
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate('/')}
                    className="w-full gap-2 text-muted-foreground"
                    data-testid="demo-step1-back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to home
                  </Button>
                </div>
              )}

              {/* Step 2: Company Details */}
              {step === 2 && (
                <div className="space-y-6" data-testid="demo-step2">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name *</Label>
                    <Input
                      id="company_name"
                      placeholder="Acme Services"
                      {...register("company_name")}
                      data-testid="demo-company-input"
                      className={errors.company_name ? "border-destructive" : ""}
                    />
                    {errors.company_name && (
                      <p className="text-sm text-destructive" data-testid="demo-error-company">{errors.company_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Industry *</Label>
                    <Select onValueChange={(value) => setValue("industry", value)}>
                      <SelectTrigger className={errors.industry ? "border-destructive" : ""} data-testid="demo-industry-select">
                        <SelectValue placeholder="Select your industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map((industry) => (
                          <SelectItem key={industry.value} value={industry.value} data-testid={`industry-${industry.value}`}>
                            {industry.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.industry && (
                      <p className="text-sm text-destructive" data-testid="demo-error-industry">{errors.industry.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Team Size *</Label>
                    <Select onValueChange={(value) => setValue("team_size", value)}>
                      <SelectTrigger className={errors.team_size ? "border-destructive" : ""} data-testid="demo-teamsize-select">
                        <SelectValue placeholder="Select team size" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamSizes.map((size) => (
                          <SelectItem key={size.value} value={size.value} data-testid={`teamsize-${size.value}`}>
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.team_size && (
                      <p className="text-sm text-destructive" data-testid="demo-error-teamsize">{errors.team_size.message}</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={prevStep} className="flex-1" size="lg" data-testid="demo-step2-back">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button type="button" onClick={nextStep} className="flex-1" size="lg" data-testid="demo-step2-continue">
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Schedule */}
              {step === 3 && (
                <div className="space-y-6" data-testid="demo-step3">
                  <div className="space-y-2">
                    <Label>Preferred Date (Optional)</Label>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          data-testid="demo-date-picker"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => {
                            setValue("preferred_date", date);
                            setCalendarOpen(false);
                          }}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                          data-testid="demo-calendar"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Time (Optional)</Label>
                    <Select onValueChange={(value) => setValue("preferred_time", value)}>
                      <SelectTrigger data-testid="demo-time-select">
                        <SelectValue placeholder="Select a time slot" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time} data-testid={`time-${time.replace(/\s|:/g, '')}`}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Times shown in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Anything else you'd like us to know? (Optional)</Label>
                    <Textarea
                      id="message"
                      placeholder="Tell us about your specific needs or challenges..."
                      rows={4}
                      {...register("message")}
                      data-testid="demo-message-input"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={prevStep} className="flex-1" size="lg" data-testid="demo-step3-back">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" size="lg" disabled={isSubmitting} data-testid="demo-submit-button">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" data-testid="demo-submit-loading" />
                          Submitting...
                        </>
                      ) : (
                        "Schedule Consultation"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Success */}
              {step === 4 && (
                <div className="text-center py-8" data-testid="demo-success-container">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="h-10 w-10 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Consultation Request Received!
                  </h2>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    Thank you for your interest in FieldTek. One of our product specialists 
                    will reach out within 24 hours to schedule your consultation. Check your email for confirmation.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button asChild variant="outline" data-testid="demo-return-home">
                      <Link to="/">Return to Home</Link>
                    </Button>
                    <Button asChild data-testid="demo-join-waitlist">
                      <Link to="/register">Join Waitlist</Link>
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Trust indicators */}
          {step < 4 && (
            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                🔒 Your information is secure and will never be shared
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
