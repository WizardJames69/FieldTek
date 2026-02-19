import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationToggleProps {
  variant?: 'card' | 'inline';
}

export function PushNotificationToggle({ variant = 'card' }: PushNotificationToggleProps) {
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    subscribe,
    unsubscribe,
    isSubscribing,
    isUnsubscribing,
  } = usePushNotifications();

  const isProcessing = isSubscribing || isUnsubscribing;

  if (!isSupported) {
    if (variant === 'inline') return null;
    
    return (
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BellOff className="h-4 w-4 text-muted-foreground" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in this browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleToggle = () => {
    if (isSubscribed) {
      unsubscribe();
    } else {
      subscribe();
    }
  };

  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSubscribed ? (
            <BellRing className="h-4 w-4 text-primary" />
          ) : (
            <Bell className="h-4 w-4 text-muted-foreground" />
          )}
          <Label htmlFor="push-toggle" className="text-sm font-medium">
            Push Notifications
          </Label>
          {permission === 'denied' && (
            <Badge variant="destructive" className="text-xs">Blocked</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
          <Switch
            id="push-toggle"
            checked={isSubscribed}
            onCheckedChange={handleToggle}
            disabled={isLoading || isProcessing || permission === 'denied'}
          />
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {isSubscribed ? (
              <BellRing className="h-4 w-4 text-primary" />
            ) : (
              <Bell className="h-4 w-4 text-muted-foreground" />
            )}
            Push Notifications
          </CardTitle>
          {permission === 'denied' && (
            <Badge variant="destructive">Blocked</Badge>
          )}
          {isSubscribed && permission === 'granted' && (
            <Badge variant="secondary" className="bg-success/10 text-success">Enabled</Badge>
          )}
        </div>
        <CardDescription>
          {permission === 'denied' 
            ? 'Notifications are blocked. Please enable them in your browser settings.'
            : isSubscribed
              ? 'You will receive push notifications for job assignments and updates.'
              : 'Enable push notifications to get instant alerts for job assignments.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant={isSubscribed ? 'outline' : 'default'}
          onClick={handleToggle}
          disabled={isLoading || isProcessing || permission === 'denied'}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isSubscribing ? 'Enabling...' : 'Disabling...'}
            </>
          ) : isSubscribed ? (
            <>
              <BellOff className="h-4 w-4 mr-2" />
              Disable Notifications
            </>
          ) : (
            <>
              <Bell className="h-4 w-4 mr-2" />
              Enable Notifications
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
