import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { FeatureGate } from "@/components/FeatureGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Key, Shield, Clock, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = `https://dlrhobkrjfegtbdsqdsa.supabase.co/functions/v1/tenant-api`;

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateRawKey(): string {
  const arr = new Uint8Array(36);
  crypto.getRandomValues(arr);
  return (
    "ft_live_" +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="relative group">
      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto font-mono leading-relaxed border">
        <code>{code}</code>
      </pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

// ─── Create Key Dialog ────────────────────────────────────────────────────────

interface CreateKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  tenantId: string;
  userId: string;
}

function CreateKeyDialog({ open, onClose, onCreated, tenantId, userId }: CreateKeyDialogProps) {
  const [name, setName] = useState("");
  const [readScope, setReadScope] = useState(true);
  const [writeScope, setWriteScope] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  function reset() {
    setName("");
    setReadScope(true);
    setWriteScope(false);
    setCreatedKey(null);
    setAcknowledged(false);
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Key name is required");
      return;
    }
    setLoading(true);
    try {
      const rawKey = generateRawKey();
      const keyHash = await sha256Hex(rawKey);
      // prefix shown in UI: "ft_live_" + first 8 chars of the random part + "..."
      const keyPart = rawKey.replace("ft_live_", "");
      const keyPrefix = `ft_live_${keyPart.substring(0, 8)}`;

      const scopes: string[] = [];
      if (readScope) scopes.push("read");
      if (writeScope) scopes.push("write");
      if (scopes.length === 0) scopes.push("read");

      const { error } = await supabase.from("tenant_api_keys").insert({
        tenant_id: tenantId,
        name: name.trim(),
        key_prefix: keyPrefix,
        key_hash: keyHash,
        scopes,
        created_by: userId,
      });

      if (error) throw error;

      setCreatedKey(rawKey);
      onCreated();
    } catch (err) {
      toast.error("Failed to create API key");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        {!createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Create API Key
              </DialogTitle>
              <DialogDescription>
                Give this key a descriptive name so you can identify it later.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g. Zapier Integration"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Scopes</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={readScope}
                      onCheckedChange={(v) => setReadScope(!!v)}
                    />
                    <span className="text-sm">
                      <span className="font-medium">Read</span>
                      <span className="text-muted-foreground ml-1">— GET endpoints (list/view)</span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={writeScope}
                      onCheckedChange={(v) => setWriteScope(!!v)}
                    />
                    <span className="text-sm">
                      <span className="font-medium">Write</span>
                      <span className="text-muted-foreground ml-1">— POST/PATCH endpoints (create/update)</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={loading || !name.trim()}>
                {loading ? "Creating…" : "Create Key"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-4 w-4" />
                API Key Created
              </DialogTitle>
              <DialogDescription>
                Copy this key now. You won't be able to see it again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive/90">
                  Store this key securely. It will not be shown again after you close this dialog.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Your API Key</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted border rounded-md px-3 py-2 font-mono break-all">
                    {createdKey}
                  </code>
                  <CopyButton text={createdKey} />
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  className="mt-0.5"
                  checked={acknowledged}
                  onCheckedChange={(v) => setAcknowledged(!!v)}
                />
                <span className="text-sm text-muted-foreground">
                  I've saved this key in a secure location
                </span>
              </label>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} disabled={!acknowledged}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── API Docs ────────────────────────────────────────────────────────────────

function ApiDocs() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">API Reference</CardTitle>
        <CardDescription>
          Base URL:{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{BASE_URL}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          <span>Rate limit: <strong className="text-foreground">60 requests / minute</strong> per key</span>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Authentication</Label>
          <CodeBlock code={`curl "${BASE_URL}/jobs" \\\n  -H "Authorization: Bearer ft_live_YOUR_API_KEY"`} />
        </div>

        <Accordion type="multiple" className="w-full">
          {/* Jobs */}
          <AccordionItem value="jobs">
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">Jobs</Badge>
                scheduled_jobs resource
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Method</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["GET", "/jobs", "read", "List jobs (paginated)"],
                    ["GET", "/jobs/:id", "read", "Get a single job"],
                    ["POST", "/jobs", "write", "Create a new job"],
                    ["PATCH", "/jobs/:id", "write", "Update job status/notes"],
                  ].map(([m, p, s, d]) => (
                    <TableRow key={p + m}>
                      <TableCell><Badge variant={m === "GET" ? "secondary" : "default"} className="text-xs font-mono">{m}</Badge></TableCell>
                      <TableCell><code className="text-xs">{p}</code></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{s}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-xs">{d}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Query parameters</p>
                <CodeBlock code={`GET /jobs?limit=20&page=1&status=pending&since=2025-01-01T00:00:00Z`} />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Example response</p>
                <CodeBlock language="json" code={`{
  "data": [
    {
      "id": "uuid",
      "title": "HVAC Maintenance",
      "status": "pending",
      "priority": "medium",
      "scheduled_date": "2025-03-01",
      "created_at": "2025-02-18T10:00:00Z"
    }
  ],
  "meta": { "total": 42, "page": 1, "limit": 20, "has_more": true }
}`} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Clients */}
          <AccordionItem value="clients">
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">Clients</Badge>
                clients resource
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Method</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["GET", "/clients", "read", "List clients (paginated)"],
                    ["GET", "/clients/:id", "read", "Get a single client"],
                    ["POST", "/clients", "write", "Create a new client"],
                  ].map(([m, p, s, d]) => (
                    <TableRow key={p + m}>
                      <TableCell><Badge variant={m === "GET" ? "secondary" : "default"} className="text-xs font-mono">{m}</Badge></TableCell>
                      <TableCell><code className="text-xs">{p}</code></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{s}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-xs">{d}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Create client body</p>
                <CodeBlock language="json" code={`{
  "name": "Acme Corp",        // required
  "email": "acme@example.com",
  "phone": "+1-555-0100",
  "address": "123 Main St",
  "city": "Springfield",
  "state": "IL",
  "zip_code": "62701"
}`} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Invoices */}
          <AccordionItem value="invoices">
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">Invoices</Badge>
                invoices resource (read-only)
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Method</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["GET", "/invoices", "read", "List invoices (paginated)"],
                    ["GET", "/invoices/:id", "read", "Get invoice with line items"],
                  ].map(([m, p, s, d]) => (
                    <TableRow key={p + m}>
                      <TableCell><Badge variant="secondary" className="text-xs font-mono">{m}</Badge></TableCell>
                      <TableCell><code className="text-xs">{p}</code></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{s}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-xs">{d}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Filter by status</p>
                <CodeBlock code={`GET /invoices?status=unpaid&limit=50`} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Error Codes */}
          <AccordionItem value="errors">
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              Error codes
            </AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Meaning</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["401", "INVALID_API_KEY", "Key not found or doesn't match"],
                    ["401", "KEY_REVOKED", "Key was revoked"],
                    ["401", "KEY_EXPIRED", "Key has passed its expiry date"],
                    ["401", "PLAN_REQUIRED", "Tenant not on Professional/Enterprise"],
                    ["403", "INSUFFICIENT_SCOPE", "Write scope required for this endpoint"],
                    ["404", "NOT_FOUND", "Resource not found"],
                    ["429", "RATE_LIMIT_EXCEEDED", "60 req/min limit hit"],
                  ].map(([http, code, meaning]) => (
                    <TableRow key={code}>
                      <TableCell><Badge variant="outline" className="text-xs">{http}</Badge></TableCell>
                      <TableCell><code className="text-xs">{code}</code></TableCell>
                      <TableCell className="text-muted-foreground text-xs">{meaning}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function APISettings() {
  const { tenant } = useTenant();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    });
  }, []);

  async function fetchKeys() {
    if (!tenant?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("tenant_api_keys")
      .select("id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });

    if (!error && data) setKeys(data as ApiKey[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchKeys();
  }, [tenant?.id]);

  async function revokeKey(id: string, name: string) {
    if (!confirm(`Revoke key "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase
      .from("tenant_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Failed to revoke key");
    } else {
      toast.success("Key revoked");
      fetchKeys();
    }
  }

  return (
    <FeatureGate feature="api_access">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              API Keys
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage API keys to integrate with external systems.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Key
          </Button>
        </div>

        {/* Keys table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading keys…</div>
            ) : keys.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Key className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">No API keys yet. Create one to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => (
                    <TableRow key={k.id} className={k.revoked_at ? "opacity-50" : ""}>
                      <TableCell className="font-medium text-sm">{k.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {k.key_prefix}…
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {k.scopes?.map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs capitalize">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {k.last_used_at ? format(new Date(k.last_used_at), "MMM d, yyyy") : "Never"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(k.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {k.revoked_at ? (
                          <Badge variant="destructive" className="text-xs">Revoked</Badge>
                        ) : k.expires_at && new Date(k.expires_at) < new Date() ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Expired</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-primary border-primary/30">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!k.revoked_at && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => revokeKey(k.id, k.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Security note */}
        <div className="flex items-start gap-2 rounded-md bg-muted/40 border p-3 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/70" />
          <p>
            API keys are stored as one-way hashes. The full key is shown only once at creation.
            Revoke a key immediately if it's compromised — revocation takes effect on the next request.
          </p>
        </div>

        {/* API Docs */}
        <ApiDocs />

        {/* Create dialog */}
        {tenant?.id && userId && (
          <CreateKeyDialog
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onCreated={fetchKeys}
            tenantId={tenant.id}
            userId={userId}
          />
        )}
      </div>
    </FeatureGate>
  );
}
