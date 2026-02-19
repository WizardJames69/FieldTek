import React, { useState, useCallback, memo, useEffect, useRef } from 'react';
import { useConversation } from '@elevenlabs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneOff, Volume2, Loader2, Play, Clock, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface DemoVoiceAgentProps {
  onSceneChange?: (sceneId: number) => void;
  onLeadCapture?: () => void;
  onSessionStart?: (sessionId: string) => void;
  onConnectionChange?: (connected: boolean) => void;
}

interface TranscriptMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

export const DemoVoiceAgent = memo(function DemoVoiceAgent({ 
  onSceneChange,
  onLeadCapture,
  onSessionStart,
  onConnectionChange
}: DemoVoiceAgentProps) {
  const navigate = useNavigate();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionPhase, setConnectionPhase] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [scenesViewed, setScenesViewed] = useState<Set<number>>(new Set());
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [demoInfo, setDemoInfo] = useState<{ demoCount: number; maxDemos: number | null } | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [maxDurationSeconds, setMaxDurationSeconds] = useState<number>(180);
  const [lastAgentActivity, setLastAgentActivity] = useState<number | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scene mapping for client tools
  const sceneMap: Record<string, number> = {
    // canonical
    'request': 0,
    'schedule': 1,
    'mobile': 2,
    'ai': 3,
    'invoice': 4,

    // common synonyms the agent might send
    'service_request': 0,
    'service request': 0,
    'intake': 0,

    'scheduling': 1,
    'calendar': 1,
    'dispatch': 1,

    'app': 2,
    'technician': 2,
    'field': 2,

    'assistant': 3,
    'ai_help': 3,
    'ai help': 3,
    'ai_assistant': 3,

    'invoicing': 4,
    'billing': 4,
    'payment': 4,
  };

  const sceneCount = 5;

  const getSceneIndexFromToolParams = useCallback((params: any): number | undefined => {
    // Support agents that pass either a raw string/number or an object
    let raw: any = params;

    // If params is a JSON string, try to parse it
    if (typeof raw === "string") {
      const s = raw.trim();
      if (s.startsWith("{") && s.endsWith("}")) {
        try {
          raw = JSON.parse(s);
        } catch {
          // ignore
        }
      }
    }

    if (raw && typeof raw === "object") {
      raw =
        raw?.sceneId ??
        raw?.scene ??
        raw?.scene_id ??
        raw?.sceneIndex ??
        raw?.index ??
        raw?.id ??
        raw?.value;
    }

    if (raw === undefined || raw === null) return undefined;

    // numeric values
    if (typeof raw === "number" && Number.isFinite(raw)) {
      if (raw >= 0 && raw <= sceneCount - 1) return raw;
      if (raw >= 1 && raw <= sceneCount) return raw - 1;
      return undefined;
    }

    // strings (either names or numbers)
    const str = String(raw).trim().toLowerCase();
    if (!str) return undefined;

    if (str in sceneMap) return sceneMap[str];

    const n = Number(str);
    if (!Number.isNaN(n)) {
      if (n >= 0 && n <= sceneCount - 1) return n;
      if (n >= 1 && n <= sceneCount) return n - 1;
    }

    return undefined;
  }, [sceneMap]);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to demo agent');
      setErrorMessage(null);
      setTranscript([]);
      onConnectionChange?.(true);
    },
    onDisconnect: () => {
      console.log('Disconnected from demo agent');
      onConnectionChange?.(false);
      setRemainingSeconds(null);
      // Clear timer
      if (durationTimerRef.current) {
        clearTimeout(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      // Mark session as completed
      if (sessionId) {
        updateSessionEnd(false);
      }
    },
    onMessage: (message) => {
      console.log('Demo message:', message);
      
      // Handle transcripts - message is a union type, check properties safely
      const msgAny = message as any;
      if (msgAny.user_transcription_event?.user_transcript) {
        setTranscript(prev => [...prev, {
          role: 'user',
          content: msgAny.user_transcription_event.user_transcript,
          timestamp: new Date()
        }]);
      }
      
      if (msgAny.agent_response_event?.agent_response) {
        let agentResponse = msgAny.agent_response_event.agent_response as string;
        setLastAgentActivity(Date.now());
        
        // FALLBACK PARSER: Detect if agent spoke tool names instead of calling them
        const showScenePatterns = [
          /showScene\s*\(\s*["']?(\w+)["']?\s*\)/gi,
          /showScene\s*\(\s*\{[^}]*["']?sceneId["']?\s*:\s*["']?(\w+)["']?[^}]*\}\s*\)/gi,
          /\{"?sceneId"?\s*:\s*"?(\w+)"?\}/gi,
        ];
        
        for (const pattern of showScenePatterns) {
          let match;
          while ((match = pattern.exec(agentResponse)) !== null) {
            const sceneId = match[1]?.toLowerCase();
            console.log('[DemoVoiceAgent] Fallback parser detected showScene in text:', sceneId);
            if (sceneId && sceneId in sceneMap) {
              const sceneIndex = sceneMap[sceneId];
              console.log('[DemoVoiceAgent] Fallback parser triggering scene:', sceneIndex);
              setScenesViewed(prev => new Set(prev).add(sceneIndex));
              onSceneChange?.(sceneIndex);
            }
            // Remove the tool text from display
            agentResponse = agentResponse.replace(match[0], '').trim();
          }
        }
        
        if (agentResponse) {
          setTranscript(prev => [...prev, {
            role: 'agent',
            content: agentResponse,
            timestamp: new Date()
          }]);
        }
      }
    },
    onError: (error) => {
      console.error('Demo conversation error:', error);
      setErrorMessage('Connection error. Please try again.');
      toast.error('Voice agent connection error');
      onConnectionChange?.(false);
    },
    clientTools: {
      showScene: (params: any) => {
        console.log('[DemoVoiceAgent] showScene called with params:', JSON.stringify(params));
        const sceneIndex = getSceneIndexFromToolParams(params);
        console.log('[DemoVoiceAgent] Resolved sceneIndex:', sceneIndex);
        if (sceneIndex !== undefined) {
          // Track scene view for analytics
          setScenesViewed(prev => new Set(prev).add(sceneIndex));
          onSceneChange?.(sceneIndex);
        }
        return "";
      },
      captureLeadInfo: () => {
        onLeadCapture?.();
        return "";
      },
      bookHumanDemo: () => {
        navigate('/consultation');
        return "";
      },
      navigateToSignup: () => {
        navigate('/register');
        return "";
      }
    }
  });

  const isConnected = conversation.status === 'connected';

  // Start countdown timer when connected
  useEffect(() => {
    if (!isConnected || remainingSeconds === null) return;
    
    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isConnected, remainingSeconds !== null]);

  // Auto-end session when timer reaches 0
  useEffect(() => {
    if (remainingSeconds === 0 && isConnected) {
      toast.info("Demo session ended (3 minute limit)");
      stopConversation(true);
    }
  }, [remainingSeconds, isConnected]);

  const updateSessionEnd = useCallback(async (autoEnded: boolean = false) => {
    if (!sessionId) return;
    
    try {
      // Calculate duration
      const durationSeconds = sessionStartTime 
        ? Math.round((new Date().getTime() - sessionStartTime.getTime()) / 1000)
        : null;

      await supabase
        .from('demo_sessions')
        .update({
          ended_at: new Date().toISOString(),
          completed: true,
          duration_seconds: durationSeconds,
          scenes_viewed: Array.from(scenesViewed),
          auto_ended: autoEnded,
        })
        .eq('id', sessionId);
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  }, [sessionId, sessionStartTime, scenesViewed]);

  const withTimeout = useCallback(<T,>(promise: Promise<T>, ms: number, label: string) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} timed out`));
      }, ms);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
  }, []);

  // Fetch with abort + retry logic
  const fetchDemoToken = useCallback(async (requestId: string, attempt: number = 1): Promise<any> => {
    const MAX_ATTEMPTS = 3;
    const TIMEOUT_MS = 12000;
    
    abortControllerRef.current = new AbortController();
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/demo-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'x-request-id': requestId,
        },
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      
      // Retry on timeout or network errors
      if (attempt < MAX_ATTEMPTS) {
        const backoff = attempt * 500 + Math.random() * 500;
        console.log(`[DemoVoiceAgent] Attempt ${attempt} failed, retrying in ${Math.round(backoff)}ms...`);
        await new Promise(r => setTimeout(r, backoff));
        return fetchDemoToken(requestId, attempt + 1);
      }
      
      throw err;
    }
  }, []);

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    setLastAgentActivity(null);
    const requestId = crypto.randomUUID().slice(0, 8);
    
    setConnectionPhase("Requesting microphone...");

    try {
      // Request microphone permission
      await withTimeout(
        navigator.mediaDevices.getUserMedia({ audio: true }),
        15000,
        "Microphone permission"
      );
      console.log("[DemoVoiceAgent] Microphone permission granted");

      // Ping backend first to verify connectivity
      setConnectionPhase("Checking connection...");
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const pingResponse = await fetch(`${supabaseUrl}/functions/v1/demo-token?ping=1`, {
          headers: { 'apikey': anonKey },
          signal: AbortSignal.timeout(5000),
        });
        if (!pingResponse.ok) throw new Error('Ping failed');
        console.log("[DemoVoiceAgent] Backend ping successful");
      } catch (pingErr) {
        console.warn("[DemoVoiceAgent] Backend ping failed:", pingErr);
        throw new Error('Backend unreachable. Check your network or try disabling ad-blockers.');
      }

      // Get token with retries
      setConnectionPhase("Requesting demo token (attempt 1/3)...");
      const data = await fetchDemoToken(requestId);

      if (data?.error) {
        if (data.reason === 'ip_limit_exceeded') {
          setErrorMessage(`Daily demo limit reached (${data.limit} per day). Try again tomorrow!`);
          return;
        }
        throw new Error(data.error);
      }

      // We need at least one of token or signedUrl
      if (!data?.token && !data?.signedUrl) {
        throw new Error('No connection credentials received from server');
      }

      // Log any warnings from the backend
      if (data?.warnings?.length) {
        console.warn('[DemoVoiceAgent] Backend warnings:', data.warnings);
      }

      setSessionId(data.sessionId);
      setSessionStartTime(new Date());
      setScenesViewed(new Set());
      setDemoInfo({ demoCount: data.demoCount, maxDemos: data.maxDemos });
      setMaxDurationSeconds(data.maxDurationSeconds || 180);
      setRemainingSeconds(data.maxDurationSeconds || 180);

      // Notify parent of session start
      if (onSessionStart && data.sessionId) {
        onSessionStart(data.sessionId);
      }

      // Decide connection strategy based on what we received
      const hasToken = !!data?.token;
      const hasSignedUrl = !!data?.signedUrl;

      if (hasToken) {
        // Try WebRTC first (best quality/latency). If it hangs, fall back to WebSocket.
        setConnectionPhase("Connecting (WebRTC)...");
        try {
          await withTimeout(
            conversation.startSession({
              conversationToken: data.token,
              connectionType: 'webrtc',
            }),
            15000,
            "WebRTC connection"
          );
          console.log("[DemoVoiceAgent] WebRTC connection successful");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const shouldFallback = msg.toLowerCase().includes('timed out');

          if (shouldFallback && hasSignedUrl) {
            console.warn('[DemoVoiceAgent] WebRTC timed out; falling back to WebSocket');
            setConnectionPhase("Connecting (WebSocket)...");
            toast.info('Switching to a more compatible connection…');

            try {
              await conversation.endSession();
            } catch {
              // ignore
            }

            await withTimeout(
              conversation.startSession({
                signedUrl: data.signedUrl,
                connectionType: 'websocket',
              }),
              15000,
              "WebSocket connection"
            );
            console.log("[DemoVoiceAgent] WebSocket fallback successful");
          } else {
            throw err;
          }
        }
      } else if (hasSignedUrl) {
        // Only signedUrl available, go straight to WebSocket
        setConnectionPhase("Connecting (WebSocket)...");
        console.log("[DemoVoiceAgent] No token, using WebSocket directly");
        await withTimeout(
          conversation.startSession({
            signedUrl: data.signedUrl,
            connectionType: 'websocket',
          }),
          15000,
          "WebSocket connection"
        );
        console.log("[DemoVoiceAgent] WebSocket connection successful");
      }
    } catch (error) {
      console.error('Failed to start demo:', error);
      const message = error instanceof Error ? error.message : 'Failed to connect';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsConnecting(false);
      setConnectionPhase(null);
      abortControllerRef.current = null;
    }
  }, [conversation, onSessionStart, withTimeout, fetchDemoToken]);

  const stopConversation = useCallback(async (autoEnded: boolean = false) => {
    if (autoEnded) {
      await updateSessionEnd(true);
    }
    await conversation.endSession();
  }, [conversation, updateSessionEnd]);

  // Enhanced speaking detection: use isSpeaking OR recent agent activity
  const isSpeaking = conversation.isSpeaking || (lastAgentActivity !== null && Date.now() - lastAgentActivity < 1500);
  
  // Enable audio helper
  const enableAudio = useCallback(async () => {
    try {
      await conversation.setVolume({ volume: 1 });
      setAudioMuted(false);
      toast.success('Audio enabled');
    } catch {
      toast.error('Could not enable audio');
    }
  }, [conversation]);

  // Format remaining time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="bg-card border border-border/50 rounded-xl p-4 md:p-5 shadow-md">
      {/* Compact Header with Status */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div 
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isConnected 
                ? isSpeaking 
                  ? 'bg-primary animate-pulse' 
                  : 'bg-green-500' 
                : 'bg-muted-foreground'
            }`} 
          />
          <span className="text-xs text-muted-foreground truncate">
            {isConnected 
              ? isSpeaking 
                ? 'AI presenting...' 
                : 'Listening...'
              : 'Ready'}
          </span>
        </div>
        
        {/* Timer & Demo Count - compact row */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {demoInfo?.maxDemos && !isConnected && (
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">
              {demoInfo.demoCount}/{demoInfo.maxDemos}
            </span>
          )}
          {isConnected && remainingSeconds !== null && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className={`text-xs font-medium ${remainingSeconds <= 30 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {formatTime(remainingSeconds)}
              </span>
            </div>
          )}
          {audioMuted && isConnected && (
            <Button variant="ghost" size="sm" onClick={enableAudio} className="gap-1 h-5 px-1.5">
              <VolumeX className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Compact Voice Visualization */}
      <div className="flex items-center justify-center mb-3">
        <div className={`relative w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center ${
          isConnected 
            ? 'bg-primary/10' 
            : 'bg-muted'
        }`}>
          <AnimatePresence mode="wait">
            {isConnected ? (
              <motion.div
                key="connected"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="relative"
              >
                {isSpeaking && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full border border-primary"
                      animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full border border-primary"
                      animate={{ scale: [1, 1.7, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                    />
                  </>
                )}
                <Volume2 className="w-6 h-6 md:w-7 md:h-7 text-primary" />
              </motion.div>
            ) : (
              <motion.div
                key="disconnected"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Play className="w-6 h-6 md:w-7 md:h-7 text-muted-foreground" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Compact Transcript panel */}
      {isConnected && transcript.length > 0 && (
        <div className="mb-3 max-h-16 md:max-h-20 overflow-y-auto bg-muted/30 rounded-lg p-2 space-y-1">
          {transcript.slice(-3).map((msg, idx) => (
            <div 
              key={idx} 
              className={`text-[10px] md:text-xs leading-tight ${msg.role === 'user' ? 'text-muted-foreground' : 'text-foreground'}`}
            >
              <span className="font-medium">{msg.role === 'user' ? 'You' : 'AI'}:</span>{' '}
              {msg.content.length > 80 ? msg.content.slice(0, 80) + '...' : msg.content}
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-destructive text-center mb-2"
          data-testid="voice-agent-error"
        >
          {errorMessage}
        </motion.p>
      )}

      {/* Compact Action button */}
      <div className="flex justify-center">
        {isConnected ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => stopConversation(false)}
            className="gap-1.5 h-8 text-xs"
            data-testid="voice-agent-end-button"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            End Demo
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={startConversation}
            disabled={isConnecting}
            className="gap-1.5 h-8 text-xs"
            data-testid="voice-agent-start-button"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" data-testid="voice-agent-loading" />
                {connectionPhase ? connectionPhase.replace('...', '') : "Starting"}
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Start AI Demo
              </>
            )}
          </Button>
        )}
      </div>

      {/* Minimal instructions - only when disconnected */}
      {!isConnected && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          AI will guide you through FieldTek
        </p>
      )}
    </div>
  );
});

export default DemoVoiceAgent;
