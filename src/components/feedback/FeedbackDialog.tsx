import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bug, Lightbulb, MessageSquare, HelpCircle, Upload, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useIsMobile } from '@/hooks/use-mobile';

const feedbackSchema = z.object({
  feedback_type: z.enum(['bug', 'feature', 'feedback', 'question']),
  title: z.string().min(3, 'Subject must be at least 3 characters').max(100, 'Subject must be less than 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description must be less than 2000 characters'),
  urgency: z.enum(['low', 'medium', 'high']).default('medium'),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

const feedbackTypes = [
  { value: 'bug', label: 'Bug', icon: Bug, color: 'text-red-500' },
  { value: 'feature', label: 'Feature', icon: Lightbulb, color: 'text-amber-500' },
  { value: 'feedback', label: 'General', icon: MessageSquare, color: 'text-blue-500' },
  { value: 'question', label: 'Question', icon: HelpCircle, color: 'text-purple-500' },
] as const;

const urgencyOptions = [
  { value: 'low', label: 'Low', description: 'Nice to have' },
  { value: 'medium', label: 'Medium', description: 'Should fix soon' },
  { value: 'high', label: 'High', description: 'Blocking my work' },
] as const;

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      feedback_type: 'feedback',
      title: '',
      description: '',
      urgency: 'medium',
    },
  });

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Screenshot must be less than 5MB',
          variant: 'destructive',
        });
        return;
      }
      setScreenshot(file);
    }
  };

  const removeScreenshot = () => {
    setScreenshot(null);
  };

  const onSubmit = async (data: FeedbackFormData) => {
    if (!user || !tenant) {
      toast({
        title: 'Error',
        description: 'You must be logged in to submit feedback',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let screenshotUrl: string | null = null;

      // Upload screenshot if provided
      if (screenshot) {
        const fileExt = screenshot.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('feedback-screenshots')
          .upload(fileName, screenshot);

        if (uploadError) {
          console.error('Screenshot upload error:', uploadError);
        } else {
          screenshotUrl = fileName;
        }
      }

      // Insert feedback
      const { error } = await supabase.from('beta_feedback').insert({
        tenant_id: tenant.id,
        user_id: user.id,
        feedback_type: data.feedback_type,
        title: data.title,
        description: data.description,
        urgency: data.urgency,
        page_context: location.pathname,
        screenshot_url: screenshotUrl,
      });

      if (error) throw error;

      toast({
        title: 'Thanks for your feedback! 🎉',
        description: "We'll review it soon. Your input helps us improve!",
      });

      form.reset();
      setScreenshot(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Feedback submission error:', error);
      toast({
        title: 'Failed to submit feedback',
        description: 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const FormContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Feedback Type Selection */}
        <FormField
          control={form.control}
          name="feedback_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What type of feedback?</FormLabel>
              <FormControl>
                <div className="grid grid-cols-4 gap-2">
                  {feedbackTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = field.value === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => field.onChange(type.value)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50 hover:bg-muted'
                        )}
                      >
                        <Icon className={cn('h-5 w-5', isSelected ? 'text-primary' : type.color)} />
                        <span className={cn('text-xs font-medium', isSelected && 'text-primary')}>
                          {type.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Subject */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject</FormLabel>
              <FormControl>
                <Input placeholder="Brief summary of your feedback" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tell us more</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe your feedback in detail. Include steps to reproduce if reporting a bug."
                  className="min-h-[120px] resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Urgency */}
        <FormField
          control={form.control}
          name="urgency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Urgency</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex gap-2"
                >
                  {urgencyOptions.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 p-2.5 rounded-lg border cursor-pointer transition-all',
                        field.value === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <RadioGroupItem value={option.value} className="sr-only" />
                      <span className={cn('text-sm font-medium', field.value === option.value && 'text-primary')}>
                        {option.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </label>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Screenshot Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Screenshot (optional)</label>
          {screenshot ? (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className="flex-1 truncate text-sm">{screenshot.name}</div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={removeScreenshot}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Attach a screenshot</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleScreenshotChange}
              />
            </label>
          )}
        </div>

        {/* Submit */}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Feedback'
          )}
        </Button>
      </form>
    </Form>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Share Your Feedback</DrawerTitle>
            <DrawerDescription>
              Help us improve FieldTek during beta
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">{FormContent}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share Your Feedback</DialogTitle>
          <DialogDescription>
            Help us improve FieldTek during beta
          </DialogDescription>
        </DialogHeader>
        {FormContent}
      </DialogContent>
    </Dialog>
  );
}