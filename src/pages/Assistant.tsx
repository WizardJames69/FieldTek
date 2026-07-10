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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Send, User, Loader2, Briefcase, FileText, BookOpen, Volume2, AlertTriangle, RotateCcw, Scale, Settings2, Zap, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ImageAttachment } from "@/components/assistant/ImageAttachment";
import { VoiceInput } from "@/components/assistant/VoiceInput";
import { TextToSpeech, playTTS } from "@/components/assistant/TextToSpeech";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SuggestedQuestions, generateSuggestions } from "@/components/assistant/SuggestedQuestions";
import { DocumentCitation, ContextIndicator, type CitationSource } from "@/components/assistant/DocumentCitation";
import { DegradedAnswerBanner } from "@/components/assistant/DegradedAnswerBanner";
import { DiagnosticWizard, getDiagnosticPath, formatDiagnosticData } from "@/components/assistant/DiagnosticWizard";
import { shouldAutoOpenDiagnosticWizard, type IndustryType } from "@/config/industryAssistantConfig";
import { SaveToJobNotes } from "@/components/assistant/SaveToJobNotes";
import { SentinelMark } from "@/components/assistant/SentinelMark";
import {
  AssistantContextPanels,
  type JobContext,
  type EquipmentContext,
  type DocumentContext,
} from "@/components/assistant/AssistantContextPanels";

// Message content can be text or multimodal (text + images)
type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image_url"; image_url: { url: string } };
type MessageContent = string | Array<TextContent | ImageContent>;

type ResponseMetadata = {
  retrieval_quality_score: number;
  confidence: 'high' | 'medium' | 'low';
  chunk_count: number;
  documents_used: number;
  sources?: CitationSource[];
  // Set when the answer came from the full-document fallback rather than
  // targeted retrieval (e.g. search was unavailable or indexing is incomplete).
  // Surfaced to the user as a banner so a degraded answer is never mistaken for
  // a retrieval-grounded one. See field-assistant/degradation.ts (PR-1.5a).
  degraded?: boolean;
  degraded_reason?: 'retrieval_unavailable' | 'indexing_incomplete';
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

interface ClientContext {
  id: string;
  name: string;
  notes: string | null;
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
  const [jobSearchQuery, setJobSearchQuery] = useState("");
  const [contextSheetOpen, setContextSheetOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(() => {
    return localStorage.getItem("assistant-context-rail") === "collapsed";
  });
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
  // Whether any assistant reply (streamed token or JSON body) arrived for the
  // in-flight send; decides if a failed send is pulled back into the composer.
  const assistantRepliedRef = useRef(false);


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

  // Scroll to bottom when messages change. The ref sits on the ScrollArea
  // root, which is overflow-hidden; the actual scrollable node is the Radix
  // viewport inside it, so scroll that.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const viewport = root.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]") ?? root;
    viewport.scrollTop = viewport.scrollHeight;
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

    // Non-streaming JSON replies (abstain gate, human-review refusal)
    // arrive as a 200 application/json body. Without this branch they
    // would fall into the SSE parser below and be silently discarded.
    const contentType = resp.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await resp.json().catch(() => ({}));

      // Deterministic compliance block: a 200 JSON body carrying `compliance_blocked`
      // and `verdicts` but no `response`/`error`. Render the blocked rules clearly
      // instead of falling through to the "Empty response" throw below.
      if (body.compliance_blocked === true) {
        const verdicts: Array<{ rule?: string; explanation?: string; code_references?: string[] }> =
          Array.isArray(body.verdicts) ? body.verdicts : [];
        const lines = verdicts.map((v) => {
          const refs =
            v.code_references && v.code_references.length > 0
              ? ` (${v.code_references.join(", ")})`
              : "";
          return `• ${v.rule ?? "Rule"}: ${v.explanation ?? "blocked"}${refs}`;
        });
        const content = [
          "This action is blocked by compliance rules:",
          "",
          ...(lines.length > 0
            ? lines
            : ["• A required compliance check has not been satisfied."]),
          "",
          "An owner or admin can override this from the job's workflow panel.",
        ].join("\n");
        assistantRepliedRef.current = true;
        setMessages((prev) => [...prev, { role: "assistant", content }]);
        return;
      }

      const text: string | undefined = body.response || body.error;
      if (!text) throw new Error("Empty response from assistant");
      assistantRepliedRef.current = true;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: text,
          metadata: body.metadata as ResponseMetadata | undefined,
        },
      ]);
      return;
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
            assistantRepliedRef.current = true;
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

    // Check for diagnostic wizard trigger. Scope to the tenant's industry so an
    // HVAC question can't match an elevator-only path, and only AUTO-OPEN for
    // clear troubleshooting symptoms — informational/RAG questions that merely
    // mention a trigger word must flow straight to chat.
    if (!overrideContent) {
      const industry = tenant?.industry as IndustryType | undefined;
      const diagnosticPath = getDiagnosticPath(messageText, industry);
      if (shouldAutoOpenDiagnosticWizard(messageText, diagnosticPath)) {
        setPendingDiagnosticText(messageText);
        setShowDiagnosticWizard(true);
        return;
      }
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
    const imagesSnapshot = attachedImages;
    assistantRepliedRef.current = false;
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedImages([]);
    setIsLoading(true);

    try {
      await streamChat([...messages, userMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      if (!assistantRepliedRef.current) {
        // Nothing came back: pull the failed message out of the transcript
        // and put it back in the composer so a retry is one tap, not a retype.
        toast.error(error instanceof Error ? error.message : "Failed to get response", {
          description: "Your message was restored. Tap send to retry.",
        });
        setMessages((prev) => (prev[prev.length - 1] === userMsg ? prev.slice(0, -1) : prev));
        setInput(messageText);
        if (imagesSnapshot.length > 0) setAttachedImages(imagesSnapshot);
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to get response");
      }
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

  const toggleRail = () => {
    setRailCollapsed((prev) => {
      localStorage.setItem("assistant-context-rail", prev ? "expanded" : "collapsed");
      return !prev;
    });
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
      <MainLayout title="Sentinel AI">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const hasContext = !!selectedJob || !!equipment || documents.length > 0;

  // Empty-state prompt hierarchy: one featured question plus secondary chips.
  const promptSet = codeReferenceEnabled
    ? {
        featured: "What are the GFCI requirements for kitchen outlets?",
        secondary: [
          "What's the minimum drain pipe size for a bathroom group?",
          "What clearances does a gas furnace need?",
          "What wire gauge is required for a 20A circuit?",
        ],
      }
    : documents.length > 0
      ? {
          featured: "What does my documentation say about startup procedures?",
          secondary: ["What maintenance is documented?", "What specs are in my manuals?"],
        }
      : null;

  return (
    <MainLayout title="Sentinel AI">
      <div className="h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)] flex flex-col">
        <div className="flex items-center justify-end gap-2 sm:gap-3 mb-3">
          {rateLimitInfo && (
            <div data-testid="rate-limit-display" className="flex items-center gap-1.5 text-sm text-muted-foreground mr-auto">
              <Zap className="h-4 w-4" />
              <span className={cn(
                rateLimitInfo.used >= rateLimitInfo.limit && "text-destructive font-medium"
              )}>
                {rateLimitInfo.used}/{rateLimitInfo.limit} queries today
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" aria-label="Assistant preferences">
                <Settings2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Preferences</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Scale className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <Label htmlFor="code-reference" className="text-sm cursor-pointer">
                      Building Codes
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Reference published US and Canadian building codes
                    </p>
                  </div>
                </div>
                <Switch
                  id="code-reference"
                  checked={codeReferenceEnabled}
                  onCheckedChange={handleCodeReferenceToggle}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Volume2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <Label htmlFor="auto-play-tts" className="text-sm cursor-pointer">
                      Auto-read
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Read new answers aloud automatically
                    </p>
                  </div>
                </div>
                <Switch
                  id="auto-play-tts"
                  checked={autoPlayTTS}
                  onCheckedChange={handleAutoPlayToggle}
                />
              </div>
            </PopoverContent>
          </Popover>
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

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Desktop context rail — collapsible; mobile uses the Context sheet */}
          <div className={cn("hidden lg:flex shrink-0 flex-col min-h-0", railCollapsed ? "w-10" : "w-64")}>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleRail}
              aria-label={railCollapsed ? "Expand context panel" : "Collapse context panel"}
              className={cn(
                "mb-2 text-muted-foreground hover:text-foreground",
                railCollapsed ? "w-10 px-0 justify-center" : "self-start gap-1.5 px-2"
              )}
            >
              {railCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4" />
                  <span className="text-xs">Hide context</span>
                </>
              )}
            </Button>
            {!railCollapsed && (
              <div className="min-h-0 overflow-y-auto custom-scrollbar pr-0.5">
                <AssistantContextPanels
                  jobs={jobs}
                  selectedJob={selectedJob}
                  jobSearchQuery={jobSearchQuery}
                  onJobSearchQueryChange={setJobSearchQuery}
                  onJobSelect={handleJobSelect}
                  onClearJob={clearJobContext}
                  equipment={equipment}
                  documents={documents}
                />
              </div>
            )}
          </div>

          {/* Chat Area */}
          <Card className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Sentinel identity bar */}
            <div className="border-b bg-muted/30">
              <div className="flex items-center gap-2.5 px-3 md:px-4 py-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center shrink-0">
                  <SentinelMark className="h-[18px] w-[18px] text-primary" />
                </div>
                <div className="min-w-0 mr-auto">
                  <p className="font-display text-sm font-bold leading-tight text-foreground">Sentinel</p>
                  <p className="text-[11px] text-muted-foreground leading-tight truncate">
                    Field diagnostic assistant
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setContextSheetOpen(true)}
                  className="lg:hidden h-8 gap-1.5 shrink-0"
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  Context
                  {selectedJob && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </Button>
              </div>
              {hasContext && (
                <div className="px-3 md:px-4 pb-2">
                  <ContextIndicator
                    jobTitle={selectedJob?.title}
                    equipmentType={equipment?.equipment_type}
                    documentCount={documents.length}
                    onClearContext={selectedJob ? clearJobContext : undefined}
                    className="bg-transparent px-0 py-0"
                  />
                </div>
              )}
            </div>
            <ScrollArea className="flex-1 px-3 md:px-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div data-testid="assistant-empty-state" className="h-full flex flex-col items-center justify-center px-4 py-8">
                  <div className="w-full max-w-md">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center shrink-0">
                        <SentinelMark className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-display text-lg md:text-xl font-bold tracking-tight">
                        How can I help you today?
                      </h3>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">
                      {codeReferenceEnabled
                        ? "Ask about code compliance, requirements, or regulations for electrical, plumbing, and HVAC work."
                        : documents.length === 0
                          ? "Upload equipment manuals to unlock cited, equipment-specific answers. You can still ask general troubleshooting questions or share photos from the field."
                          : "Ask about symptoms, procedures, specifications, or previous work. Sentinel checks the documentation available to your team before answering."
                      }
                    </p>

                    {/* Grounding status */}
                    <div className="flex flex-wrap items-center gap-2 mb-5">
                      {documents.length > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-300 px-3 py-1 text-xs font-medium">
                          <FileText className="h-3.5 w-3.5" />
                          {documents.length} Document{documents.length !== 1 ? 's' : ''} Available
                        </span>
                      )}
                      {codeReferenceEnabled && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 px-3 py-1 text-xs font-medium">
                          <Scale className="h-3.5 w-3.5" />
                          Code Reference Mode Active
                        </span>
                      )}
                      {documents.length === 0 && !codeReferenceEnabled && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground px-3 py-1 text-xs font-medium">
                          <BookOpen className="h-3.5 w-3.5" />
                          No documentation uploaded yet
                        </span>
                      )}
                    </div>

                    {promptSet ? (
                      <div>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left h-auto whitespace-normal rounded-xl bg-card shadow-card px-4 py-3 text-sm font-medium mb-2"
                          onClick={() => setInput(promptSet.featured)}
                        >
                          {promptSet.featured}
                        </Button>
                        <div className="flex flex-wrap gap-2">
                          {promptSet.secondary.map((suggestion) => (
                            <Button
                              key={suggestion}
                              variant="outline"
                              size="sm"
                              className="rounded-full whitespace-normal h-auto py-2 max-w-full text-muted-foreground hover:text-foreground"
                              onClick={() => setInput(suggestion)}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => navigate("/documents")}
                      >
                        Upload Documentation
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-5 py-4">
                  {messages.map((msg, i) => {
                    const textContent = getTextContent(msg.content);
                    const imageUrls = getImageUrls(msg.content);
                    const isLastAssistantMessage = msg.role === "assistant" && i === messages.length - 1;

                    return (
                      <div key={i} data-testid={`chat-message-${msg.role}`} className="message-in">
                        <div
                          className={cn(
                            "flex gap-3",
                            msg.role === "user" ? "justify-end" : "justify-start"
                          )}
                        >
                          {msg.role === "assistant" && (
                            <div className="h-8 w-8 rounded-lg bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center shrink-0">
                              <SentinelMark className="h-4 w-4 text-primary" strokeWidth={2.1} />
                            </div>
                          )}
                          {msg.role === "assistant" ? (
                            (() => {
                              const { sources: regexSources, cleanContent } = parseDocumentSources(textContent);
                              const structuredSources = msg.metadata?.sources;
                              return (
                                <div className="max-w-[80%] space-y-2">
                                  <div className="chat-bubble-assistant rounded-2xl rounded-tl-md px-4 py-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="whitespace-pre-wrap text-sm leading-relaxed flex-1">{cleanContent || textContent}</p>
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
                                  {msg.metadata?.degraded && msg.metadata.degraded_reason && (
                                    <DegradedAnswerBanner reason={msg.metadata.degraded_reason} />
                                  )}
                                  {structuredSources && structuredSources.length > 0 ? (
                                    <DocumentCitation citations={structuredSources} />
                                  ) : regexSources.length > 0 ? (
                                    <DocumentCitation sources={regexSources} />
                                  ) : null}
                                  {msg.metadata?.confidence && (
                                    <div data-testid="confidence-badge" className={cn(
                                      "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full w-fit font-medium",
                                      msg.metadata.confidence === 'high' && "bg-green-500/15 text-green-700 dark:text-green-300",
                                      msg.metadata.confidence === 'medium' && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                                      msg.metadata.confidence === 'low' && "bg-red-500/15 text-red-700 dark:text-red-300",
                                    )}>
                                      <span className={cn(
                                        "h-1.5 w-1.5 rounded-full",
                                        msg.metadata.confidence === 'high' && "bg-green-500",
                                        msg.metadata.confidence === 'medium' && "bg-amber-500",
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
                                <div className="rounded-2xl rounded-br-md px-4 py-2.5 chat-bubble-user text-primary-foreground">
                                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{textContent}</p>
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
                    <div data-testid="assistant-loading" className="flex gap-3 message-in">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                        <SentinelMark className="h-4 w-4 text-primary" strokeWidth={2.1} />
                      </div>
                      <div className="chat-bubble-assistant rounded-2xl rounded-tl-md px-4 py-3.5 flex items-center gap-1">
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground/70" />
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <div className="p-3 md:p-4 border-t bg-muted/20">
              {/* Diagnostic Wizard */}
              {showDiagnosticWizard && (
                <div className="mx-auto max-w-3xl mb-3">
                  <DiagnosticWizard
                    symptomText={pendingDiagnosticText}
                    onComplete={handleDiagnosticComplete}
                    onCancel={handleDiagnosticCancel}
                    industry={tenant?.industry as IndustryType | undefined}
                  />
                </div>
              )}

              {/* Integrated composer: attachments, input, voice, send */}
              <div className="mx-auto max-w-3xl">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <SentinelMark className="h-3 w-3 text-primary" strokeWidth={2.2} />
                  Ask Sentinel
                </p>
                <div className="flex flex-wrap items-center gap-1 rounded-2xl border bg-card shadow-card px-1.5 py-1.5 transition-shadow focus-within:border-ring/40 focus-within:ring-2 focus-within:ring-ring/20">
                  <ImageAttachment
                    images={attachedImages}
                    onImagesChange={setAttachedImages}
                    maxImages={4}
                    disabled={isLoading}
                  />
                  <span className="hidden sm:block h-5 w-px bg-border mx-0.5" aria-hidden="true" />
                  <Input
                    data-testid="chat-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about troubleshooting, or use voice/camera..."
                    disabled={isLoading}
                    className="flex-1 min-w-[140px] h-10 border-0 bg-transparent shadow-none px-2 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <VoiceInput
                    onTranscript={(text) => setInput((prev) => prev ? `${prev} ${text}` : text)}
                    disabled={isLoading}
                  />
                  <Button
                    data-testid="send-message-button"
                    size="icon"
                    className="h-10 w-10 rounded-xl shrink-0 shadow-sm"
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
            </div>
          </Card>
        </div>

        {/* Mobile/tablet context sheet — same panels as the desktop rail */}
        <Sheet open={contextSheetOpen} onOpenChange={setContextSheetOpen}>
          <SheetContent side="right" className="w-[85vw] sm:max-w-sm overflow-y-auto">
            <SheetHeader className="mb-3 text-left">
              <SheetTitle className="font-display text-lg">Context</SheetTitle>
            </SheetHeader>
            <AssistantContextPanels
              jobs={jobs}
              selectedJob={selectedJob}
              jobSearchQuery={jobSearchQuery}
              onJobSearchQueryChange={setJobSearchQuery}
              onJobSelect={handleJobSelect}
              onClearJob={clearJobContext}
              equipment={equipment}
              documents={documents}
            />
          </SheetContent>
        </Sheet>
      </div>
    </MainLayout>
  );
}
