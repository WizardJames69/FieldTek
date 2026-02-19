import { useState } from "react";
import { Copy, Check, Mail, Phone, Flame, Droplet, Zap, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  emailTemplates, 
  phoneScripts, 
  industryOutreachConfig,
  type EmailTemplate,
  type PhoneScript 
} from "@/data/mediaKitOutreach";
import { cn } from "@/lib/utils";

type Industry = 'hvac' | 'plumbing' | 'electrical' | 'mechanical';
type ContentType = 'emails' | 'scripts';
type EmailType = 'cold' | 'followup';
type ScriptType = 'call' | 'voicemail';

const IndustryIcon = ({ industry }: { industry: Industry }) => {
  switch (industry) {
    case 'hvac': return <Flame className="h-4 w-4" />;
    case 'plumbing': return <Droplet className="h-4 w-4" />;
    case 'electrical': return <Zap className="h-4 w-4" />;
    case 'mechanical': return <Wrench className="h-4 w-4" />;
  }
};

export function OutreachTab() {
  const [contentType, setContentType] = useState<ContentType>('emails');
  const [industryFilter, setIndustryFilter] = useState<Industry | 'all'>('all');
  const [emailTypeFilter, setEmailTypeFilter] = useState<EmailType | 'all'>('all');
  const [scriptTypeFilter, setScriptTypeFilter] = useState<ScriptType | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredEmails = emailTemplates.filter(email => {
    const industryMatch = industryFilter === 'all' || email.industry === industryFilter;
    const typeMatch = emailTypeFilter === 'all' || email.type === emailTypeFilter;
    return industryMatch && typeMatch;
  });

  const filteredScripts = phoneScripts.filter(script => {
    const industryMatch = industryFilter === 'all' || script.industry === industryFilter;
    const typeMatch = scriptTypeFilter === 'all' || script.type === scriptTypeFilter;
    return industryMatch && typeMatch;
  });

  const getEmailFullContent = (email: EmailTemplate) => {
    return `Subject: ${email.subject}\n\n${email.body}`;
  };

  return (
    <TabsContent value="outreach" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Sales Outreach Templates
          </CardTitle>
          <CardDescription>
            Industry-specific email templates and phone scripts for sales outreach. One-click copy for immediate use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle between Emails and Phone Scripts */}
          <div className="flex gap-2">
            <Button
              variant={contentType === 'emails' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setContentType('emails')}
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Email Templates
              <Badge variant="secondary" className="ml-1">{emailTemplates.length}</Badge>
            </Button>
            <Button
              variant={contentType === 'scripts' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setContentType('scripts')}
              className="flex items-center gap-2"
            >
              <Phone className="h-4 w-4" />
              Phone Scripts
              <Badge variant="secondary" className="ml-1">{phoneScripts.length}</Badge>
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Industry Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Industry:</span>
              <div className="flex gap-1 flex-wrap">
                {(['all', 'hvac', 'plumbing', 'electrical', 'mechanical'] as const).map((ind) => (
                  <Button
                    key={ind}
                    variant={industryFilter === ind ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIndustryFilter(ind)}
                    className="text-xs"
                  >
                    {ind === 'all' ? 'All' : industryOutreachConfig[ind].label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Type:</span>
              <div className="flex gap-1">
                {contentType === 'emails' ? (
                  <>
                    <Button
                      variant={emailTypeFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEmailTypeFilter('all')}
                      className="text-xs"
                    >
                      All
                    </Button>
                    <Button
                      variant={emailTypeFilter === 'cold' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEmailTypeFilter('cold')}
                      className="text-xs"
                    >
                      Cold
                    </Button>
                    <Button
                      variant={emailTypeFilter === 'followup' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEmailTypeFilter('followup')}
                      className="text-xs"
                    >
                      Follow-Up
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant={scriptTypeFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setScriptTypeFilter('all')}
                      className="text-xs"
                    >
                      All
                    </Button>
                    <Button
                      variant={scriptTypeFilter === 'call' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setScriptTypeFilter('call')}
                      className="text-xs"
                    >
                      Cold Call
                    </Button>
                    <Button
                      variant={scriptTypeFilter === 'voicemail' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setScriptTypeFilter('voicemail')}
                      className="text-xs"
                    >
                      Voicemail
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Email Templates */}
          {contentType === 'emails' && (
            <div className="space-y-4">
              {filteredEmails.map((email) => (
                <div key={email.id} className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={cn("flex items-center gap-1", industryOutreachConfig[email.industry].color)}>
                        <IndustryIcon industry={email.industry} />
                        {industryOutreachConfig[email.industry].label}
                      </Badge>
                      <Badge className={email.type === 'cold' ? 'bg-blue-500/10 text-blue-600' : 'bg-green-500/10 text-green-600'}>
                        {email.type === 'cold' ? 'Cold Outreach' : 'Follow-Up'}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="bg-muted/50 rounded-lg p-3 border border-border">
                      <p className="text-sm font-medium text-foreground mb-1">Subject:</p>
                      <p className="text-sm text-muted-foreground">{email.subject}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap font-mono text-muted-foreground border border-border">
                      {email.body}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleCopy(getEmailFullContent(email), email.id)}
                      className="w-full sm:w-auto"
                    >
                      {copiedId === email.id ? (
                        <>
                          <Check className="h-4 w-4 mr-2 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Email
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
              {filteredEmails.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No emails match the current filters.
                </div>
              )}
            </div>
          )}

          {/* Phone Scripts */}
          {contentType === 'scripts' && (
            <div className="space-y-4">
              {filteredScripts.map((script) => (
                <div key={script.id} className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">{script.title}</span>
                      <Badge variant="outline" className={cn("flex items-center gap-1", industryOutreachConfig[script.industry].color)}>
                        <IndustryIcon industry={script.industry} />
                        {industryOutreachConfig[script.industry].label}
                      </Badge>
                      <Badge className={script.type === 'call' ? 'bg-purple-500/10 text-purple-600' : 'bg-amber-500/10 text-amber-600'}>
                        {script.type === 'call' ? 'Cold Call' : 'Voicemail'}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap font-mono text-muted-foreground border border-border mb-3">
                      {script.content}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleCopy(script.content, script.id)}
                      className="w-full sm:w-auto"
                    >
                      {copiedId === script.id ? (
                        <>
                          <Check className="h-4 w-4 mr-2 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Script
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
              {filteredScripts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No scripts match the current filters.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
