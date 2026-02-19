import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { FeatureGate } from "@/components/FeatureGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  Copy,
  Check,
  RefreshCw,
  Link2,
  Link2Off,
  ChevronDown,
  ExternalLink,
  Info,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const SUPABASE_PROJECT_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const FUNCTIONS_BASE = `${SUPABASE_PROJECT_URL}/functions/v1`;

// Generate a cryptographically secure random hex string (64 chars = 32 bytes)
async function generateIcalToken(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface CalendarSyncToken {
  id: string;
  ical_token: string;
  google_calendar_id: string | null;
  google_token_expiry: string | null;
  outlook_calendar_id: string | null;
  outlook_token_expiry: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
  created_at: string;
}

const INSTALL_GUIDES = [
  {
    platform: "Google Calendar",
    icon: "🗓️",
    steps: [
      'Open Google Calendar at calendar.google.com',
      'In the left sidebar, click the "+" next to "Other calendars"',
      'Select "From URL"',
      'Paste your feed URL and click "Add calendar"',
      'Your FieldTek jobs will appear within a few minutes',
    ],
  },
  {
    platform: "Apple Calendar / iPhone",
    icon: "🍎",
    steps: [
      'On Mac: Open Calendar app → File → New Calendar Subscription',
      'On iPhone: Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar',
      'Paste your feed URL',
      'Tap "Next" and configure the subscription name',
      'Choose refresh frequency (every hour recommended)',
    ],
  },
  {
    platform: "Outlook / Microsoft 365",
    icon: "📧",
    steps: [
      'Open Outlook Calendar at outlook.com or in the desktop app',
      'Click "Add calendar" in the left panel',
      'Select "Subscribe from web"',
      'Paste your feed URL',
      'Give it a name like "FieldTek Jobs" and click Import',
    ],
  },
  {
    platform: "Android (Google Calendar app)",
    icon: "🤖",
    steps: [
      'Calendars from URLs are synced via Google Calendar on Android',
      'Follow the Google Calendar steps above on a desktop browser',
      'The jobs will automatically appear in your Android Google Calendar app',
    ],
  },
];

function CopyButton({ text, label = "Copy URL" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2 shrink-0">
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

function OAuthProviderCard({
  provider,
  label,
  icon,
  connected,
  calendarId,
  tokenExpiry,
  onConnect,
  onDisconnect,
  onSync,
  isSyncing,
  isConfigured,
}: {
  provider: "google" | "outlook";
  label: string;
  icon: React.ReactNode;
  connected: boolean;
  calendarId: string | null;
  tokenExpiry: string | null;
  onConnect: () => void;
  onDisconnect: () => Promise<void>;
  onSync: () => Promise<void>;
  isSyncing: boolean;
  isConfigured: boolean;
}) {
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    await onDisconnect();
    setIsDisconnecting(false);
    setDisconnectOpen(false);
  };

  if (!isConfigured) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border border-dashed border-border/50 bg-muted/20">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Contact your administrator to configure {label} integration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">{icon}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{label}</p>
              {connected ? (
                <Badge variant="success" className="text-xs">Connected</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Not connected</Badge>
              )}
            </div>
            {connected && calendarId && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Calendar: {calendarId === "primary" ? "Primary calendar" : calendarId}
              </p>
            )}
            {connected && tokenExpiry && (
              <p className="text-xs text-muted-foreground">
                Token expires: {format(new Date(tokenExpiry), "MMM d, yyyy")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {connected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onSync}
                disabled={isSyncing}
                className="gap-2"
              >
                {isSyncing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Sync Now
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDisconnectOpen(true)}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Link2Off className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onConnect} className="gap-2">
              <Link2 className="h-3.5 w-3.5" />
              Connect
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Your {label} connection will be removed. Busy blocks imported from this calendar will
              be deleted. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisconnecting ? "Disconnecting…" : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function CalendarSettings() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [isSyncingOutlook, setIsSyncingOutlook] = useState(false);

  // Check if OAuth is configured (we probe by trying to initiate — 
  // the UI shows the button, and the edge function redirects back with an error if not set up)
  // We always show the connect buttons and handle the "not configured" case via redirect error.
  const isGoogleConfigured = true; // connect button always shown; edge fn handles missing secrets
  const isOutlookConfigured = true;

  const { data: syncToken, isLoading } = useQuery({
    queryKey: ["calendar-sync-token", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("calendar_sync_tokens")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as CalendarSyncToken | null;
    },
    enabled: !!user?.id,
  });

  // Auto-create token row on first load if not exists
  const createTokenMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !tenant?.id) throw new Error("No user/tenant");
      const token = await generateIcalToken();
      const { data, error } = await supabase
        .from("calendar_sync_tokens")
        .insert({ user_id: user.id, tenant_id: tenant.id, ical_token: token })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-sync-token"] });
    },
    onError: (err) => {
      toast.error("Failed to initialize calendar sync");
      console.error(err);
    },
  });

  useEffect(() => {
    if (!isLoading && !syncToken && user?.id && tenant?.id) {
      createTokenMutation.mutate();
    }
  }, [isLoading, syncToken, user?.id, tenant?.id]);

  // Handle OAuth connection result on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) {
      toast.success(`${connected === "google" ? "Google Calendar" : "Outlook"} connected successfully!`);
      queryClient.invalidateQueries({ queryKey: ["calendar-sync-token"] });
      window.history.replaceState({}, "", window.location.pathname + "?tab=calendar");
    }
    if (error) {
      const messages: Record<string, string> = {
        google_not_configured: "Google Calendar integration is not yet configured. Contact your administrator.",
        outlook_not_configured: "Outlook integration is not yet configured. Contact your administrator.",
        google_token_failed: "Failed to connect Google Calendar. Please try again.",
        outlook_token_failed: "Failed to connect Outlook. Please try again.",
        db_error: "Database error while saving connection. Please try again.",
        internal: "An unexpected error occurred. Please try again.",
      };
      toast.error(messages[error] || `OAuth error: ${error}`);
      window.history.replaceState({}, "", window.location.pathname + "?tab=calendar");
    }
  }, []);

  const regenerateTokenMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No user");
      const newToken = await generateIcalToken();
      const { error } = await supabase
        .from("calendar_sync_tokens")
        .update({ ical_token: newToken })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-sync-token"] });
      toast.success("Feed URL regenerated. Update your calendar app with the new URL.");
      setRegenerateOpen(false);
    },
    onError: () => toast.error("Failed to regenerate URL"),
  });

  const handleGoogleConnect = () => {
    if (!user?.id || !tenant?.id) return;
    const clientId = ""; // Will be injected from env — the edge function handles this
    const state = btoa(JSON.stringify({ user_id: user.id, tenant_id: tenant.id }));
    const redirectUri = encodeURIComponent(`${FUNCTIONS_BASE}/calendar-oauth`);
    const scope = encodeURIComponent(
      "https://www.googleapis.com/auth/calendar.readonly"
    );
    // We embed the client ID config lookup in the edge function —
    // for now navigate to the oauth init endpoint via a simple redirect approach
    const oauthUrl = `${FUNCTIONS_BASE}/calendar-oauth?provider=google&initiate=true&state=${state}`;
    
    // Use Google's OAuth directly from the frontend with the known flow
    // The backend will handle the token exchange in the callback
    const googleOAuthBase = "https://accounts.google.com/o/oauth2/v2/auth";
    const params = new URLSearchParams({
      client_id: clientId || "__GOOGLE_CLIENT_ID__", // placeholder — edge fn returns error if not configured
      redirect_uri: `${FUNCTIONS_BASE}/calendar-oauth`,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      access_type: "offline",
      prompt: "consent",
      state: btoa(JSON.stringify({ user_id: user.id, tenant_id: tenant.id, provider: "google" })),
    });
    
    // Since we don't expose the client ID to the frontend, we'll use the edge function to initiate
    // by redirecting through it  
    window.location.href = `${FUNCTIONS_BASE}/calendar-oauth?initiate=true&provider=google&state=${state}`;
  };

  const handleOutlookConnect = () => {
    if (!user?.id || !tenant?.id) return;
    const state = btoa(JSON.stringify({ user_id: user.id, tenant_id: tenant.id }));
    window.location.href = `${FUNCTIONS_BASE}/calendar-oauth?initiate=true&provider=outlook&state=${state}`;
  };

  const handleDisconnect = async (provider: "google" | "outlook") => {
    if (!user?.id) return;
    const updates =
      provider === "google"
        ? { google_access_token: null, google_refresh_token: null, google_token_expiry: null, google_calendar_id: null }
        : { outlook_access_token: null, outlook_refresh_token: null, outlook_token_expiry: null, outlook_calendar_id: null };

    const { error } = await supabase
      .from("calendar_sync_tokens")
      .update(updates)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to disconnect");
      return;
    }

    // Delete imported events for this provider
    await supabase
      .from("external_calendar_events")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);

    queryClient.invalidateQueries({ queryKey: ["calendar-sync-token"] });
    toast.success(`${provider === "google" ? "Google Calendar" : "Outlook"} disconnected.`);
  };

  const handleSync = async (provider: "google" | "outlook") => {
    if (provider === "google") setIsSyncingGoogle(true);
    else setIsSyncingOutlook(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${FUNCTIONS_BASE}/calendar-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      const result = await res.json();
      if (result.success) {
        const providerResult = result.results?.find((r: { provider: string }) => r.provider === provider);
        toast.success(`Synced ${providerResult?.synced ?? 0} events from ${provider === "google" ? "Google Calendar" : "Outlook"}`);
        queryClient.invalidateQueries({ queryKey: ["calendar-sync-token"] });
      } else {
        toast.error("Sync failed. Please try again.");
      }
    } catch {
      toast.error("Sync failed. Please try again.");
    } finally {
      if (provider === "google") setIsSyncingGoogle(false);
      else setIsSyncingOutlook(false);
    }
  };

  const feedUrl = syncToken
    ? `${FUNCTIONS_BASE}/calendar-feed/${syncToken.ical_token}.ics`
    : null;

  const googleConnected = !!(syncToken?.google_calendar_id);
  const outlookConnected = !!(syncToken?.outlook_calendar_id);

  if (isLoading || createTokenMutation.isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <FeatureGate feature="calendar_sync">
      <div className="space-y-6">
        {/* iCal Feed Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Your Personal Job Feed</CardTitle>
              <Badge variant="secondary" className="text-xs ml-auto">Works immediately</Badge>
            </div>
            <CardDescription>
              Subscribe to this URL in any calendar app to see your assigned FieldTek jobs — Google
              Calendar, Apple Calendar, Outlook, and more. Updates automatically every few hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {feedUrl ? (
              <>
                {/* Feed URL */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 bg-muted/60 rounded-lg px-3 py-2 border border-border/50">
                    <p className="text-sm font-mono text-foreground truncate">{feedUrl}</p>
                  </div>
                  <CopyButton text={feedUrl} />
                </div>

                {/* Regenerate + last created */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Created {format(new Date(syncToken!.created_at), "MMM d, yyyy")}
                    {syncToken?.last_synced_at && (
                      <> · Last synced {format(new Date(syncToken.last_synced_at), "MMM d 'at' h:mm a")}</>
                    )}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRegenerateOpen(true)}
                    className="gap-2 text-xs h-8"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Regenerate URL
                  </Button>
                </div>

                <Separator />

                {/* Install guides */}
                <div>
                  <p className="text-sm font-medium mb-3">How to subscribe in your calendar app:</p>
                  <div className="space-y-2">
                    {INSTALL_GUIDES.map((guide) => (
                      <Collapsible key={guide.platform}>
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors text-left">
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <span>{guide.icon}</span>
                              {guide.platform}
                            </span>
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform [[data-state=open]_&]:rotate-180" />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <ol className="mt-2 ml-4 space-y-1.5 list-decimal list-inside">
                            {guide.steps.map((step, i) => (
                              <li key={i} className="text-sm text-muted-foreground">
                                {step}
                              </li>
                            ))}
                          </ol>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Generating your feed URL…</p>
            )}
          </CardContent>
        </Card>

        {/* OAuth Connections Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Two-Way Sync</CardTitle>
              <Badge variant="outline" className="text-xs ml-auto">Shows busy time</Badge>
            </div>
            <CardDescription>
              Connect your Google Calendar or Outlook to import your personal events as "busy" blocks
              in FieldTek. Dispatchers will see when you're unavailable when scheduling jobs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <OAuthProviderCard
              provider="google"
              label="Google Calendar"
              icon={<span className="text-xl">🗓️</span>}
              connected={googleConnected}
              calendarId={syncToken?.google_calendar_id ?? null}
              tokenExpiry={syncToken?.google_token_expiry ?? null}
              onConnect={handleGoogleConnect}
              onDisconnect={() => handleDisconnect("google")}
              onSync={() => handleSync("google")}
              isSyncing={isSyncingGoogle}
              isConfigured={isGoogleConfigured}
            />
            <OAuthProviderCard
              provider="outlook"
              label="Outlook / Microsoft 365"
              icon={<span className="text-xl">📧</span>}
              connected={outlookConnected}
              calendarId={syncToken?.outlook_calendar_id ?? null}
              tokenExpiry={syncToken?.outlook_token_expiry ?? null}
              onConnect={handleOutlookConnect}
              onDisconnect={() => handleDisconnect("outlook")}
              onSync={() => handleSync("outlook")}
              isSyncing={isSyncingOutlook}
              isConfigured={isOutlookConfigured}
            />

            {/* Privacy note */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/40 mt-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong>Privacy:</strong> External calendar event details are never stored. Only the
                start/end time and a generic "Busy" label are imported to prevent scheduling conflicts.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Rate limit / info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>
            Your iCal feed is updated in real-time as jobs are assigned. External calendar apps
            typically refresh subscriptions every 6–24 hours.
          </span>
        </div>
      </div>

      {/* Regenerate confirmation dialog */}
      <AlertDialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Feed URL?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current feed URL will stop working immediately. You'll need to update the
              subscription URL in all calendar apps where you've added it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => regenerateTokenMutation.mutate()}
              disabled={regenerateTokenMutation.isPending}
            >
              {regenerateTokenMutation.isPending ? "Regenerating…" : "Yes, regenerate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FeatureGate>
  );
}
