import { formatDistanceToNow } from "date-fns";
import { Bell, Check, Trash2, FileText, AlertTriangle, Wrench, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const typeConfig: Record<string, { icon: any; color: string }> = {
  overdue_invoice: { icon: AlertTriangle, color: "text-destructive" },
  new_request: { icon: Wrench, color: "text-accent" },
  job_completed: { icon: Check, color: "text-green-500" },
  team_invite: { icon: Users, color: "text-primary" },
  invoice_paid: { icon: FileText, color: "text-green-500" },
  default: { icon: Bell, color: "text-muted-foreground" },
};

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClick,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (notification: Notification) => void;
}) {
  const config = typeConfig[notification.type] || typeConfig.default;
  const Icon = config.icon;

  return (
    <div
      role="listitem"
      className={cn(
        // Phase 5: Enhanced notification item hover states
        "flex items-start gap-3 p-3 cursor-pointer transition-all duration-150 rounded-lg",
        "hover:bg-muted/50 active:bg-muted/70",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset",
        !notification.read && "bg-accent/5 hover:bg-accent/10"
      )}
      onClick={() => onClick(notification)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(notification);
        }
      }}
      tabIndex={0}
      aria-label={`${notification.title}. ${notification.message}. ${!notification.read ? 'Unread.' : ''} ${formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}`}
    >
      <div className={cn("mt-0.5", config.color)} aria-hidden="true">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm font-medium truncate", !notification.read && "text-foreground")}>
            {notification.title}
          </p>
          {!notification.read && (
            <span className="h-2 w-2 rounded-full bg-accent flex-shrink-0" aria-hidden="true" />
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        {!notification.read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onMarkAsRead(notification.id)}
            aria-label={`Mark "${notification.title}" as read`}
          >
            <Check className="h-3 w-3" aria-hidden="true" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(notification.id)}
          aria-label={`Delete notification: ${notification.title}`}
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="relative"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          aria-haspopup="menu"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-accent text-accent-foreground"
              aria-hidden="true"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-80 backdrop-blur-xl bg-popover/95 dark:bg-popover/90"
        aria-label="Notifications menu"
      >
        <DropdownMenuLabel className="flex items-center justify-between">
          <span id="notifications-heading">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-accent hover:text-accent"
              onClick={markAllAsRead}
              aria-label="Mark all notifications as read"
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="max-h-[350px]" role="list" aria-labelledby="notifications-heading">
          {loading ? (
            <div className="flex items-center justify-center py-8" role="status" aria-label="Loading notifications">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Loading notifications...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground" role="status">
              <Bell className="h-8 w-8 mb-2 opacity-50" aria-hidden="true" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="p-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
