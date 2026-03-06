import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Send, Mail, DollarSign, Building2, MessageSquare, HelpCircle, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

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
    if (honeypot) {
      console.log("[Contact] Honeypot triggered - likely bot submission");
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
      <div className="min-h-screen bg-[#08090A] dark-page" data-testid="contact-success-container">
        <Navbar />
        <div className="pt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-lg mx-auto text-center py-16">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-8 w-8 text-green-400" data-testid="contact-success-icon" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-4" data-testid="contact-success-title">Message Sent!</h1>
              <p className="text-zinc-400 mb-8" data-testid="contact-success-message">
                Thank you for reaching out. Our team will review your message and get back to you within 1-2 business days.
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setIsSuccess(false)}
                  className="bg-transparent border-white/[0.1] text-white hover:bg-white/5"
                  data-testid="contact-send-another"
                >
                  Send Another Message
                </Button>
                <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="contact-return-home">
                  <Link to="/">Return Home</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090A] dark-page" data-testid="contact-form-container">
      <Helmet>
        <title>Contact Us — FieldTek AI | Get in Touch</title>
        <meta name="description" content="Have questions about FieldTek AI? Contact our team for sales inquiries, support, partnerships, or general questions. We respond within 1-2 business days." />
        <link rel="canonical" href="https://fieldtek.ai/contact" />
        <meta property="og:title" content="Contact Us — FieldTek AI" />
        <meta property="og:description" content="Have questions about FieldTek AI? Contact our team — we respond within 1-2 business days." />
        <meta property="og:url" content="https://fieldtek.ai/contact" />
      </Helmet>
      <Navbar />
      <div className="pt-16">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-white mb-4">Get in Touch</h1>
              <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                Have questions about FieldTek? We're here to help. Fill out the form below and our team will get back to you.
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Contact Info Sidebar */}
              <div className="space-y-6">
                <div className="bg-[#111214] border border-white/[0.06] rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-1">Contact Information</h3>
                  <p className="text-sm text-zinc-500 mb-4">Reach out directly through these channels</p>
                  <div className="space-y-4">
                    <a
                      href="mailto:sales@fieldtek.ai"
                      className="flex items-center gap-3 text-sm text-zinc-400 hover:text-orange-500 transition-colors"
                      data-testid="contact-sales-email"
                    >
                      <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-300">Sales</p>
                        <p className="text-zinc-500">sales@fieldtek.ai</p>
                      </div>
                    </a>

                    <a
                      href="mailto:info@fieldtek.ai"
                      className="flex items-center gap-3 text-sm text-zinc-400 hover:text-orange-500 transition-colors"
                      data-testid="contact-info-email"
                    >
                      <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                        <Mail className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-300">General Inquiries</p>
                        <p className="text-zinc-500">info@fieldtek.ai</p>
                      </div>
                    </a>
                  </div>
                </div>

                <div className="bg-[#111214] border border-white/[0.06] rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
                  <div className="space-y-3">
                    <Link to="/register" className="block text-sm text-zinc-500 hover:text-orange-500 transition-colors">
                      → Apply for Early Access
                    </Link>
                    <Link to="/consultation" className="block text-sm text-zinc-500 hover:text-orange-500 transition-colors">
                      → Schedule a Consultation
                    </Link>
                    <Link to="/register" className="block text-sm text-zinc-500 hover:text-orange-500 transition-colors">
                      → Join Waitlist
                    </Link>
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-2 bg-[#111214] border border-white/[0.06] rounded-xl p-6 md:p-8">
                <h3 className="text-lg font-semibold text-white mb-1">Send us a Message</h3>
                <p className="text-sm text-zinc-500 mb-6">
                  Fill out the form below and we'll respond within 1-2 business days.
                </p>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="contact-form">
                    {/* Honeypot field */}
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
                        className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2"
                        data-testid="contact-error-container"
                      >
                        <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-400 font-medium" data-testid="contact-error-message">
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
                          <FormLabel className="text-zinc-300">What can we help you with?</FormLabel>
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
                                  className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                                    field.value === type.value
                                      ? "border-orange-500 bg-orange-500/5"
                                      : "border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02]"
                                  }`}
                                  data-testid={`contact-inquiry-${type.value}`}
                                >
                                  <RadioGroupItem value={type.value} id={type.value} className="mt-0.5" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <type.icon className="h-4 w-4 text-orange-500" />
                                      <span className="font-medium text-sm text-zinc-300">{type.label}</span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">{type.description}</p>
                                  </div>
                                </Label>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage className="text-red-400" />
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
                            <FormLabel className="text-zinc-300">Name *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="John Smith"
                                className="h-11 rounded-[10px]"
                                {...field}
                                data-testid="contact-name-input"
                              />
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-zinc-300">Email *</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="john@company.com"
                                className="h-11 rounded-[10px]"
                                {...field}
                                data-testid="contact-email-input"
                              />
                            </FormControl>
                            <FormMessage className="text-red-400" />
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
                            <FormLabel className="text-zinc-300">Company</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="ACME HVAC"
                                className="h-11 rounded-[10px]"
                                {...field}
                                data-testid="contact-company-input"
                              />
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-zinc-300">Phone</FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder="(555) 123-4567"
                                className="h-11 rounded-[10px]"
                                {...field}
                                data-testid="contact-phone-input"
                              />
                            </FormControl>
                            <FormMessage className="text-red-400" />
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
                          <FormLabel className="text-zinc-300">Message *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Tell us how we can help..."
                              className="min-h-[120px] resize-none rounded-[10px]"
                              {...field}
                              data-testid="contact-message-input"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white rounded-[10px] h-11 font-semibold cta-glow"
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
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
