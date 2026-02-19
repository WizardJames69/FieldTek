import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { ArrowLeft, Send, Mail, DollarSign, Building2, MessageSquare, HelpCircle, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Please enter a valid email address").max(255, "Email must be less than 255 characters"),
  company: z.string().trim().max(100, "Company name must be less than 100 characters").optional(),
  phone: z.string().trim().max(20, "Phone must be less than 20 characters").optional(),
  inquiryType: z.enum(["sales", "support", "general", "partnership"], {
    required_error: "Please select an inquiry type",
  }),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000, "Message must be less than 2000 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const inquiryTypes = [
  { value: "sales", label: "Sales Inquiry", description: "Pricing, demos, or product questions", icon: DollarSign },
  { value: "support", label: "Customer Support", description: "Help with your account or product", icon: HelpCircle },
  { value: "general", label: "General Question", description: "Other questions or feedback", icon: MessageSquare },
  { value: "partnership", label: "Partnership", description: "Business or integration opportunities", icon: Building2 },
];

export default function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      phone: "",
      inquiryType: undefined,
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    // Honeypot check - if filled, silently reject (bots fill hidden fields)
    if (honeypot) {
      console.log("[Contact] Honeypot triggered - likely bot submission");
      // Fake success to not alert bots
      setIsSuccess(true);
      return;
    }

    console.log("[Contact] Submitting contact form:", {
      email: data.email,
      inquiryType: data.inquiryType,
    });

    setIsSubmitting(true);
    setSubmissionError(null);
    
    try {
      const { data: responseData, error } = await supabase.functions.invoke("send-contact-inquiry", {
        body: { ...data, _hp: honeypot },
      });

      console.log("[Contact] Edge function response:", { responseData, error });

      if (error) {
        console.error("[Contact] Edge function error:", error);
        throw error;
      }

      // Check for rate limiting response
      if (responseData?.rateLimited) {
        console.log("[Contact] Rate limited:", responseData);
        setSubmissionError("You've reached the maximum contact requests for now. Please try again later.");
        toast.error("Too many requests. Please try again later.");
        return;
      }

      console.log("[Contact] Submission successful, showing success view");
      setIsSuccess(true);
      toast.success("Message sent successfully! We'll get back to you soon.");
      form.reset();
    } catch (error: any) {
      console.error("[Contact] Submission failed:", error);
      const errorMessage = error.message || "Failed to send message. Please try again.";
      setSubmissionError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background" data-testid="contact-success-container">
        <div className="container mx-auto px-4 py-8">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8"
            data-testid="contact-success-back-link"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          
          <div className="max-w-lg mx-auto text-center py-16">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" data-testid="contact-success-icon" />
            </div>
            <h1 className="text-3xl font-bold mb-4" data-testid="contact-success-title">Message Sent!</h1>
            <p className="text-muted-foreground mb-8" data-testid="contact-success-message">
              Thank you for reaching out. Our team will review your message and get back to you within 1-2 business days.
            </p>
            <div className="flex gap-4 justify-center">
              <Button 
                variant="outline" 
                onClick={() => setIsSuccess(false)}
                data-testid="contact-send-another"
              >
                Send Another Message
              </Button>
              <Button asChild data-testid="contact-return-home">
                <Link to="/">Return Home</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="contact-form-container">
      <Helmet>
        <title>Contact Us — FieldTek AI | Get in Touch</title>
        <meta name="description" content="Have questions about FieldTek AI? Contact our team for sales inquiries, support, partnerships, or general questions. We respond within 1-2 business days." />
        <link rel="canonical" href="https://fieldtek.ai/contact" />
        <meta property="og:title" content="Contact Us — FieldTek AI" />
        <meta property="og:description" content="Have questions about FieldTek AI? Contact our team — we respond within 1-2 business days." />
        <meta property="og:url" content="https://fieldtek.ai/contact" />
      </Helmet>
      <div className="container mx-auto px-4 py-8">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8"
          data-testid="contact-back-link"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Get in Touch</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Have questions about FieldTek? We're here to help. Fill out the form below and our team will get back to you.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Contact Info Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contact Information</CardTitle>
                  <CardDescription>Reach out directly through these channels</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <a 
                    href="mailto:sales@fieldtek.ai" 
                    className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
                    data-testid="contact-sales-email"
                  >
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Sales</p>
                      <p className="text-muted-foreground">sales@fieldtek.ai</p>
                    </div>
                  </a>
                  
                  <a 
                    href="mailto:info@fieldtek.ai" 
                    className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
                    data-testid="contact-info-email"
                  >
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">General Inquiries</p>
                      <p className="text-muted-foreground">info@fieldtek.ai</p>
                    </div>
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link to="/demo" className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                    → Try the Interactive Demo
                  </Link>
                  <Link to="/consultation" className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                    → Schedule a Consultation
                  </Link>
                  <Link to="/register" className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                    → Join Waitlist
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Send us a Message</CardTitle>
                <CardDescription>
                  Fill out the form below and we'll respond within 1-2 business days.
                </CardDescription>
              </CardHeader>
              <CardContent>
              <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="contact-form">
                    {/* Honeypot field - invisible to users, bots will fill it */}
                    <div 
                      aria-hidden="true" 
                      style={{ 
                        position: 'absolute', 
                        left: '-9999px', 
                        width: '1px', 
                        height: '1px', 
                        overflow: 'hidden' 
                      }}
                    >
                      <label htmlFor="website_url">Website</label>
                      <input
                        type="text"
                        id="website_url"
                        name="website_url"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                      />
                    </div>
                    
                    {/* Error Display */}
                    {submissionError && (
                      <div 
                        className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2"
                        data-testid="contact-error-container"
                      >
                        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <p className="text-sm text-destructive font-medium" data-testid="contact-error-message">
                          {submissionError}
                        </p>
                      </div>
                    )}
                    
                    {/* Inquiry Type */}
                    <FormField
                      control={form.control}
                      name="inquiryType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>What can we help you with?</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="grid grid-cols-2 gap-3"
                              data-testid="contact-inquiry-type-group"
                            >
                              {inquiryTypes.map((type) => (
                                <Label
                                  key={type.value}
                                  htmlFor={type.value}
                                  className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                                    field.value === type.value ? "border-primary bg-primary/5" : "border-border"
                                  }`}
                                  data-testid={`contact-inquiry-${type.value}`}
                                >
                                  <RadioGroupItem value={type.value} id={type.value} className="mt-0.5" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <type.icon className="h-4 w-4 text-primary" />
                                      <span className="font-medium text-sm">{type.label}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                                  </div>
                                </Label>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Name & Email Row */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="John Smith" 
                                {...field} 
                                data-testid="contact-name-input"
                              />
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
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="john@company.com" 
                                {...field} 
                                data-testid="contact-email-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Company & Phone Row */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="ACME HVAC" 
                                {...field} 
                                data-testid="contact-company-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input 
                                type="tel" 
                                placeholder="(555) 123-4567" 
                                {...field} 
                                data-testid="contact-phone-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Message */}
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Tell us how we can help..."
                              className="min-h-[120px] resize-none"
                              {...field}
                              data-testid="contact-message-input"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full sm:w-auto" 
                      disabled={isSubmitting}
                      data-testid="contact-submit-button"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" data-testid="contact-submit-loading" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
