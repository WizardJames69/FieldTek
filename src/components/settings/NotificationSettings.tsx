import { Bell } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PushNotificationToggle } from '@/components/notifications/PushNotificationToggle';

export function NotificationSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Control how you receive real-time alerts about jobs, invoices, and service requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PushNotificationToggle variant="card" />
        </CardContent>
      </Card>
    </div>
  );
}
