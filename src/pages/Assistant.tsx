import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Send, Bot, User, Loader2, Briefcase, Wrench, FileText, X, BookOpen, Volume2, AlertTriangle, RotateCcw, Sparkles, Scale, ChevronsUpDown, Search, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ImageAttachment } from "@/components/assistant/ImageAttachment";
import { VoiceInput } from "@/components/assistant/VoiceInput";
import { TextToSpeech, playTTS } from "@/components/assistant/TextToSpeech";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SuggestedQuestions, generateSuggestions } from "@/components/assistant/SuggestedQuestions";
import { DocumentCitation, ContextIndicator } from "@/components/assistant/DocumentCitation";
import { DiagnosticWizard, getDiagnosticPath, formatDiagnosticData } from "@/components/assistant/DiagnosticWizard";
import { SaveToJobNotes } from "@/components/assistant/SaveToJobNotes";

// Message content can be text or multimodal (text + images)
type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image_url"; image_url: { url: string } };
type MessageContent = string | Array<TextContent | ImageContent>;

type ResponseMetadata = {
  retrieval_quality_score: number;
  confidence: 'high' | 'medium' | 'low';
  chunk_count: number;
  documents_used: number;
};

type Message = {
  role: "user" | "assistant";
  content: MessageContent;
  suggestions?: string[];
  metadata?: ResponseMetadata;
};

// Helper to extract text content from a message
function getTextContent(content: MessageContent): string {
  if (typeof content === "string") return content;
  const textParts = content.filter((p): p is TextContent => p.type === "text");
  return textParts.map((p) => p.text).join("\n");
}

// Helper to extract images from a message
function getImageUrls(content: MessageContent): string[] {
  if (typeof content === "string") return [];
  return content
    .filter((p): p is ImageContent => p.type === "image_url")
    .map((p) => p.image_url.url);
}

// Parse [Source: Document Name] citations from AI responses
function parseDocumentSources(content: string): { sources: string[]; cleanContent: string } {
  const sourceRegex = /\[Source:\s*([^\]]+)\]/gi;
  const sources: string[] = [];
  let match;
  
  while ((match = sourceRegex.exec(content)) !== null) {
    const source = match[1].trim();
    if (!sources.includes(source)) {
      sources.push(source);
    }
  }
  
  // Remove source citations from content for cleaner display
  const cleanContent = content.replace(sourceRegex, '').trim();
  
  return { sources, cleanContent };
}

interface JobContext {
  id: string;
  title: string;
  job_type: string | null;
  current_stage: string | null;
  priority: string | null;
  description: string | null;
  address: string | null;
  equipment_id: string | null;
  client_id: string | null;
}

interface EquipmentContext {
  id: string;
  equipment_type: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  install_date: string | null;
  warranty_expiry: string | null;
  location_notes: string | null;
}

interface ClientContext {
  id: string;
  name: string;
  notes: string | null;
}

interface DocumentContext {
  id: string;
  name: string;
  category: string | null;
}

export default function Assistant() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [jobs, setJobs] = useState<JobContext[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobContext | null>(null);
  const [equipment, setEquipment] = useState<EquipmentContext | null>(null);
  const [client, setClient] = useState<ClientContext | null>(null);
  const [documents, setDocuments] = useState<DocumentContext[]>([]);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [jobSearchOpen, setJobSearchOpen] = useState(false);
  const [jobSearchQuery, setJobSearchQuery] = useState("");
  const [autoPlayTTS, setAutoPlayTTS] = useState(() => {
    return localStorage.getItem("assistant-autoplay-tts") === "true";
  });
  const [codeReferenceEnabled, setCodeReferenceEnabled] = useState(() => {
    return localStorage.getItem("assistant-code-reference") === "true";
  });
  const [showDiagnosticWizard, setShowDiagnosticWizard] = useState(false);
  const [pendingDiagnosticText, setPendingDiagnosticText] = useState("");
  const [rateLimitInfo, setRateLimitInfo] = useState<{ limit: number; used: number; resets_at: string; tier: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<number>(0);
  const pendingDiagnosticDataRef = useRef<Record<string, string> | null>(null);


  // Fetch jobs for context selection with optional search
  const fetchJobs = useCallback(async (search?: string) => {
    if (!tenant?.id) return;

    let query = supabase
      .from("scheduled_jobs")
      .select("id, title, job_type, current_stage, priority, description, address, equipment_id, client_id")
      .eq("tenant_id", tenant.id)
      .in("status", ["scheduled", "in_progress"])
      .order("scheduled_date", { ascending: true })
      .limit(30);

    if (search && search.trim()) {
      query = query.ilike("title", `%${search.trim()}%`);
    }

    const { data } = await query;
    setJobs(data || []);
  }, [tenant?.id]);

  // Fetch equipment details
  const fetchEquipment = useCallback(async (equipmentId: string) => {
    const { data } = await supabase
      .from("equipment_registry")
      .select("id, equipment_type, brand, model, serial_number, install_date, warranty_expiry, location_notes")
      .eq("id", equipmentId)
      .maybeSingle();

    setEquipment(data);
  }, []);

  // Fetch client details
  const fetchClient = useCallback(async (clientId: string) => {
    const { data } = await supabase
      .from("clients")
      .select("id, name, notes")
      .eq("id", clientId)
      .maybeSingle();

    setClient(data);
  }, []);

  // Fetch relevant documents
  const fetchDocuments = useCallback(async () => {
    if (!tenant?.id) return;

    const { data } = await supabase
      .from("documents")
      .select("id, name, category")
      .eq("tenant_id", tenant.id)
      .limit(10);

    setDocuments(data || []);
  }, [tenant?.id]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (!tenantLoading && !tenant) {
      navigate("/onboarding");
      return;
    }
  }, [user, tenant, authLoading, tenantLoading, navigate]);

  useEffect(() => {
    if (tenant?.id) {
      fetchJobs();
      fetchDocuments();
    }
  }, [tenant?.id, fetchJobs, fetchDocuments]);

  // Debounced job search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tenant?.id) {
        fetchJobs(jobSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [jobSearchQuery, tenant?.id, fetchJobs]);

  // Handle job selection from URL params
  useEffect(() => {
    const jobId = searchParams.get("job");
    if (jobId && jobs.length > 0) {
      const job = jobs.find((j) => j.id === jobId);
      if (job) {
        handleJobSelect(job.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, jobs]);

  const handleJobSelect = async (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    setSelectedJob(job);
    
    if (job.equipment_id) {
      await fetchEquipment(job.equipment_id);
    } else {
      setEquipment(null);
    }
    
    if (job.client_id) {
      await fetchClient(job.client_id);
    } else {
      setClient(null);
    }
  };

  const clearJobContext = () => {
    setSelectedJob(null);
    setEquipment(null);
    setClient(null);
  };

  const clearConversation = () => {
    setMessages([]);
    lastMessageIdRef.current = 0;
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (userMessages: Message[]) => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/field-assistant`;

    const context: any = {
      industry: tenant?.industry || "general",
      codeReferenceEnabled,
      country: (tenant as any)?.country || 'US',
    };

    if (selectedJob) context.job = selectedJob;
    if (equipment) context.equipment = equipment;
    if (client) context.client = client;
    if (documents.length > 0) context.documents = documents;
    if (pendingDiagnosticDataRef.current) {
      context.diagnosticData = pendingDiagnosticDataRef.current;
      pendingDiagnosticDataRef.current = null;
    }

    // Get user's session token for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Not authenticated. Please log in again.");
    }

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ messages: userMessages, context }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      if (resp.status === 429 && errorData.limit) {
        setRateLimitInfo({
          limit: errorData.limit,
          used: errorData.used,
          resets_at: errorData.resets_at,
          tier: errorData.tier,
        });
        toast.error(`Daily limit reached (${errorData.used}/${errorData.limit})`, {
          description: errorData.tier !== "enterprise" ? "Upgrade your plan for more AI queries." : undefined,
          duration: 8000,
        });
        return;
      }
      throw new Error(errorData.error || "Failed to get response");
    }

    // Read rate limit headers from successful responses
    const rlLimit = resp.headers.get("X-RateLimit-Limit");
    const rlUsed = resp.headers.get("X-RateLimit-Used");
    const rlTier = resp.headers.get("X-RateLimit-Tier");
    if (rlLimit && rlUsed) {
      const resetsAt = new Date();
      resetsAt.setUTCDate(resetsAt.getUTCDate() + 1);
      resetsAt.setUTCHours(0, 0, 0, 0);
      setRateLimitInfo({
        limit: parseInt(rlLimit, 10),
        used: parseInt(rlUsed, 10) + 1, // +1 for the current request
        resets_at: resetsAt.toISOString(),
        tier: rlTier || "trial",
      });
    }

    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";
    let responseMetadata: ResponseMetadata | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);

          // Check for metadata event (sent before content)
          if (parsed.metadata) {
            responseMetadata = parsed.metadata as ResponseMetadata;
            continue;
          }

          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: assistantContent } : m
                );
              }
              return [...prev, { role: "assistant", content: assistantContent }];
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Generate suggestions after response is complete
    const suggestions = generateSuggestions(
      assistantContent,
      !!equipment,
      documents.length > 0
    );

    // Update the last message with suggestions and metadata
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant") {
        return prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, suggestions, metadata: responseMetadata } : m
        );
      }
      return prev;
    });

    // Rate limit counter is now updated via response headers above
  };

  const handleSend = async (overrideContent?: string) => {
    const messageText = overrideContent || input.trim();
    
    if ((!messageText && attachedImages.length === 0) || isLoading) return;

    // Check for diagnostic wizard trigger
    if (!overrideContent && getDiagnosticPath(messageText)) {
      setPendingDiagnosticText(messageText);
      setShowDiagnosticWizard(true);
      return;
    }

    // Build message content - multimodal if images are attached
    let messageContent: MessageContent;
    if (attachedImages.length > 0) {
      const contentParts: Array<TextContent | ImageContent> = [];
      if (messageText) {
        contentParts.push({ type: "text", text: messageText });
      }
      for (const img of attachedImages) {
        contentParts.push({ type: "image_url", image_url: { url: img } });
      }
      messageContent = contentParts;
    } else {
      messageContent = messageText;
    }

    const userMsg: Message = { role: "user", content: messageContent };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedImages([]);
    setIsLoading(true);

    try {
      await streamChat([...messages, userMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to get response");
      // Remove the last assistant message if there was an error during streaming
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle diagnostic wizard completion
  const handleDiagnosticComplete = (data: Record<string, string>) => {
    setShowDiagnosticWizard(false);
    const diagnosticContext = formatDiagnosticData(data);
    const fullMessage = `${pendingDiagnosticText}\n\n${diagnosticContext}`;
    setPendingDiagnosticText("");
    // Store raw diagnostic data for structured audit logging
    pendingDiagnosticDataRef.current = data;
    handleSend(fullMessage);
  };

  const handleDiagnosticCancel = () => {
    setShowDiagnosticWizard(false);
    // Send the original message without diagnostic data
    if (pendingDiagnosticText) {
      handleSend(pendingDiagnosticText);
      setPendingDiagnosticText("");
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  // Toggle auto-play and persist preference
  const handleAutoPlayToggle = (checked: boolean) => {
    setAutoPlayTTS(checked);
    localStorage.setItem("assistant-autoplay-tts", String(checked));
  };

  const handleCodeReferenceToggle = (checked: boolean) => {
    setCodeReferenceEnabled(checked);
    localStorage.setItem("assistant-code-reference", String(checked));
  };

  // Auto-play TTS when new assistant message is completed
  useEffect(() => {
    if (!autoPlayTTS || isLoading) return;
    
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;
    
    const currentMessageId = messages.length;
    if (currentMessageId <= lastMessageIdRef.current) return;
    
    lastMessageIdRef.current = currentMessageId;
    
    const text = getTextContent(lastMessage.content);
    const { cleanContent } = parseDocumentSources(text);
    const finalText = cleanContent || text;
    
    if (finalText.trim()) {
      playTTS(finalText).catch((err) => {
        console.error("Auto-play TTS error:", err);
      });
    }
  }, [messages, isLoading, autoPlayTTS]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (authLoading || tenantLoading) {
    return (
      <MainLayout title="AI Assistant">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="AI Assistant">
      <div className="h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)] flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 md:mb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Field Assistant
            </h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Get help with troubleshooting, procedures, and technical questions
            </p>
          </div>
          <div className="flex items-center gap-4">
            {rateLimitInfo && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="h-3.5 w-3.5" />
                <span className={cn(
                  rateLimitInfo.used >= rateLimitInfo.limit && "text-destructive font-medium"
                )}>
                  {rateLimitInfo.used}/{rateLimitInfo.limit} today
                </span>
              </div>
            )}
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearConversation}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New Chat
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <Switch
                id="code-reference"
                checked={codeReferenceEnabled}
                onCheckedChange={handleCodeReferenceToggle}
              />
              <Label htmlFor="code-reference" className="text-sm cursor-pointer">
                Code Ref
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Switch
                id="auto-play-tts"
                checked={autoPlayTTS}
                onCheckedChange={handleAutoPlayToggle}
              />
              <Label htmlFor="auto-play-tts" className="text-sm cursor-pointer">
                Auto-read
              </Label>
            </div>
          </div>
        </div>

        {/* Rate limit warning banner */}
        {rateLimitInfo && rateLimitInfo.used >= rateLimitInfo.limit && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Daily limit reached</AlertTitle>
            <AlertDescription>
              You've used all {rateLimitInfo.limit} AI queries for today ({rateLimitInfo.tier} plan). 
              Queries reset at midnight UTC.
              {rateLimitInfo.tier !== "enterprise" && " Upgrade your plan for more queries."}
            </AlertDescription>
          </Alert>
        )}

        {/* Context indicator bar */}
        <ContextIndicator
          jobTitle={selectedJob?.title}
          equipmentType={equipment?.equipment_type}
          documentCount={documents.length}
          onClearContext={selectedJob ? clearJobContext : undefined}
          className="mb-3"
        />

        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Context Panel - Hidden on mobile, shown as collapsible on tablet+ */}
          <div className="hidden lg:block w-72 shrink-0 space-y-4">
            <Card className="p-4 context-panel-glass">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Job Context
              </h3>
              <Popover open={jobSearchOpen} onOpenChange={setJobSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={jobSearchOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selectedJob ? selectedJob.title : "Search for a job..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search jobs..."
                      value={jobSearchQuery}
                      onValueChange={setJobSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No jobs found.</CommandEmpty>
                      <CommandGroup>
                        {jobs.map((job) => (
                          <CommandItem
                            key={job.id}
                            value={job.title}
                            onSelect={() => {
                              handleJobSelect(job.id);
                              setJobSearchOpen(false);
                              setJobSearchQuery("");
                            }}
                          >
                            <Search className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate">{job.title}</span>
                            {job.job_type && (
                              <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">
                                {job.job_type}
                              </Badge>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {selectedJob && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{selectedJob.job_type || "General"}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={clearJobContext}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  {selectedJob.current_stage && (
                    <p className="text-xs text-muted-foreground">
                      Stage: {selectedJob.current_stage}
                    </p>
                  )}
                  {selectedJob.address && (
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedJob.address}
                    </p>
                  )}
                </div>
              )}
            </Card>

            {equipment && (
              <Card className="p-4 context-panel-glass">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Equipment
                </h3>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{equipment.equipment_type}</p>
                  {equipment.brand && (
                    <p className="text-muted-foreground">
                      {equipment.brand} {equipment.model}
                    </p>
                  )}
                  {equipment.serial_number && (
                    <p className="text-xs text-muted-foreground">
                      S/N: {equipment.serial_number}
                    </p>
                  )}
                  {equipment.warranty_expiry && (
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs mt-2",
                        new Date(equipment.warranty_expiry) < new Date()
                          ? "border-destructive text-destructive"
                          : "border-emerald-500 text-emerald-600"
                      )}
                    >
                      Warranty: {new Date(equipment.warranty_expiry) < new Date() ? "Expired" : "Active"}
                    </Badge>
                  )}
                </div>
              </Card>
            )}

            {documents.length > 0 && (
              <Card className="p-4 context-panel-glass">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Available Docs
                </h3>
                <div className="space-y-1">
                  {documents.slice(0, 5).map((doc) => (
                    <p key={doc.id} className="text-xs text-muted-foreground truncate">
                      {doc.name}
                    </p>
                  ))}
                  {documents.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      +{documents.length - 5} more
                    </p>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Chat Area */}
          <Card className="flex-1 flex flex-col min-w-0 app-glass-container">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">How can I help you today?</h3>
                  
                  {/* Documentation Warning Banner */}
                  {documents.length === 0 && !codeReferenceEnabled && (
                    <Alert variant="destructive" className="mb-4 max-w-lg text-left">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>No Documentation Uploaded</AlertTitle>
                      <AlertDescription>
                        I can only provide guidance from uploaded manufacturer manuals. 
                        <strong className="block mt-1">
                          Please upload equipment manuals, spec sheets, and warranty documents in the Documents section before asking technical questions.
                        </strong>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {documents.length > 0 && (
                    <Alert className="mb-4 max-w-lg text-left bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                      <BookOpen className="h-4 w-4" />
                      <AlertTitle>{documents.length} Document{documents.length !== 1 ? 's' : ''} Available</AlertTitle>
                      <AlertDescription>
                        I can reference your uploaded documentation. All technical guidance I provide will be cited from these sources.
                      </AlertDescription>
                    </Alert>
                  )}

                  {codeReferenceEnabled && (
                    <Alert className="mb-4 max-w-lg text-left bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400">
                      <Scale className="h-4 w-4" />
                      <AlertTitle>Code Reference Mode Active</AlertTitle>
                      <AlertDescription>
                        I can reference published US and Canadian building codes (NEC, CEC, IPC, NPC, IMC, etc.). All code references will cite specific sections. Always verify with your local AHJ.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <p className="text-muted-foreground max-w-md">
                    {codeReferenceEnabled
                      ? "Ask about code compliance, requirements, or regulations for electrical, plumbing, and HVAC work."
                      : documents.length === 0 
                        ? "Without documentation, I cannot answer technical questions. I can only describe what I observe in images."
                        : "Ask me about troubleshooting, procedures, or technical questions. I'll only answer from your uploaded documentation."
                    }
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4 justify-center">
                    {codeReferenceEnabled ? (
                      [
                        "What are the GFCI requirements for kitchen outlets?",
                        "What's the minimum drain pipe size for a bathroom group?",
                        "What clearances does a gas furnace need?",
                        "What wire gauge is required for a 20A circuit?",
                      ].map((suggestion) => (
                        <Button
                          key={suggestion}
                          variant="outline"
                          size="sm"
                          onClick={() => setInput(suggestion)}
                        >
                          {suggestion}
                        </Button>
                      ))
                    ) : documents.length > 0 ? (
                      [
                        "What does my documentation say about startup procedures?",
                        "What maintenance is documented?",
                        "What specs are in my manuals?",
                      ].map((suggestion) => (
                        <Button
                          key={suggestion}
                          variant="outline"
                          size="sm"
                          onClick={() => setInput(suggestion)}
                        >
                          {suggestion}
                        </Button>
                      ))
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/documents")}
                      >
                        Upload Documentation
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, i) => {
                    const textContent = getTextContent(msg.content);
                    const imageUrls = getImageUrls(msg.content);
                    const isLastAssistantMessage = msg.role === "assistant" && i === messages.length - 1;
                    
                    return (
                      <div key={i}>
                        <div
                          className={cn(
                            "flex gap-3",
                            msg.role === "user" ? "justify-end" : "justify-start"
                          )}
                        >
                          {msg.role === "assistant" && (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Bot className="h-4 w-4 text-primary" />
                            </div>
                          )}
                          {msg.role === "assistant" ? (
                            (() => {
                              const { sources, cleanContent } = parseDocumentSources(textContent);
                              return (
                                <div className="max-w-[80%] space-y-2">
                                  <div className="chat-bubble-assistant rounded-lg px-4 py-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="whitespace-pre-wrap text-sm flex-1">{cleanContent || textContent}</p>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <TextToSpeech text={cleanContent || textContent} />
                                        {selectedJob?.id && (
                                          <SaveToJobNotes
                                            jobId={selectedJob.id}
                                            content={cleanContent || textContent}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {sources.length > 0 && (
                                    <DocumentCitation sources={sources} />
                                  )}
                                  {msg.metadata?.confidence && (
                                    <div className={cn(
                                      "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md w-fit",
                                      msg.metadata.confidence === 'high' && "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30",
                                      msg.metadata.confidence === 'medium' && "text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950/30",
                                      msg.metadata.confidence === 'low' && "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/30",
                                    )}>
                                      <span className={cn(
                                        "h-1.5 w-1.5 rounded-full",
                                        msg.metadata.confidence === 'high' && "bg-green-500",
                                        msg.metadata.confidence === 'medium' && "bg-yellow-500",
                                        msg.metadata.confidence === 'low' && "bg-red-500",
                                      )} />
                                      {msg.metadata.confidence === 'high' && "High confidence"}
                                      {msg.metadata.confidence === 'medium' && "Medium confidence"}
                                      {msg.metadata.confidence === 'low' && "Low confidence — verify with documentation"}
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <div className="max-w-[80%] space-y-2">
                              {/* User message images */}
                              {imageUrls.length > 0 && (
                                <div className="flex flex-wrap gap-2 justify-end">
                                  {imageUrls.map((url, idx) => (
                                    <img
                                      key={idx}
                                      src={url}
                                      alt={`Attached ${idx + 1}`}
                                      className="max-h-32 rounded-lg border"
                                    />
                                  ))}
                                </div>
                              )}
                              {textContent && (
                                <div className="rounded-lg px-4 py-2 chat-bubble-user text-primary-foreground">
                                  <p className="whitespace-pre-wrap text-sm">{textContent}</p>
                                </div>
                              )}
                            </div>
                          )}
                          {msg.role === "user" && (
                            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <User className="h-4 w-4 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                        
                        {/* Suggested questions after assistant messages */}
                        {isLastAssistantMessage && msg.suggestions && msg.suggestions.length > 0 && !isLoading && (
                          <div className="ml-11 mt-3">
                            <SuggestedQuestions
                              suggestions={msg.suggestions}
                              onSelect={handleSuggestionClick}
                              disabled={isLoading}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="chat-bubble-assistant rounded-lg px-4 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t space-y-3">
              {/* Diagnostic Wizard */}
              {showDiagnosticWizard && (
                <DiagnosticWizard
                  symptomText={pendingDiagnosticText}
                  onComplete={handleDiagnosticComplete}
                  onCancel={handleDiagnosticCancel}
                />
              )}

              {/* Image and voice attachment UI */}
              <div className="flex items-center gap-2">
                <ImageAttachment
                  images={attachedImages}
                  onImagesChange={setAttachedImages}
                  maxImages={4}
                  disabled={isLoading}
                />
                <VoiceInput
                  onTranscript={(text) => setInput((prev) => prev ? `${prev} ${text}` : text)}
                  disabled={isLoading}
                />
              </div>
              
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about troubleshooting, or use voice/camera..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button 
                  onClick={() => handleSend()} 
                  disabled={isLoading || (!input.trim() && attachedImages.length === 0)}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
