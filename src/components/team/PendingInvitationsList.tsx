import { useState, useEffect } from 'react';
import { Mail, Clock, RotateCw, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface PendingInvitation {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
  expires_at: string;
  // Note: token is intentionally excluded for security - not exposed to frontend
}

interface PendingInvitationsListProps {
  onInvitationChange?: () => void;
}

const roleColors: Record<AppRole, string> = {
  owner: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  admin: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  dispatcher: 'bg-green-500/10 text-green-500 border-green-500/20',
  technician: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  client: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export function PendingInvitationsList({ onInvitationChange }: PendingInvitationsListProps) {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchInvitations = async () => {
    if (!tenant?.id) return;

    try {
      // Use the safe view that excludes invitation tokens
      const { data, error } = await supabase
        .from('team_invitations_safe')
        .select('id, email, role, created_at, expires_at')
        .eq('tenant_id', tenant.id)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [tenant?.id]);

  const handleResend = async (invitation: PendingInvitation) => {
    setResendingId(invitation.id);
    try {
      // Call the edge function to resend the invitation
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-team-invitation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: invitation.email,
            role: invitation.role,
            resend: true,
            invitationId: invitation.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to resend invitation');
      }

      toast({
        title: 'Invitation resent',
        description: `A new invitation email has been sent to ${invitation.email}`,
      });

      fetchInvitations();
      onInvitationChange?.();
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend invitation',
        variant: 'destructive',
      });
    } finally {
      setResendingId(null);
    }
  };

  const handleRevoke = async (invitation: PendingInvitation) => {
    setRevokingId(invitation.id);
    try {
      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitation.id);

      if (error) throw error;

      toast({
        title: 'Invitation revoked',
        description: `The invitation to ${invitation.email} has been revoked`,
      });

      fetchInvitations();
      onInvitationChange?.();
    } catch (error: any) {
      console.error('Error revoking invitation:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke invitation',
        variant: 'destructive',
      });
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Pending Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Pending Invitations
          <Badge variant="secondary" className="ml-2">
            {invitations.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invitations.map((invitation) => {
            const isExpired = isPast(new Date(invitation.expires_at));
            
            return (
              <div
                key={invitation.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isExpired ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate">
                      {invitation.email}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`${roleColors[invitation.role]} capitalize text-xs`}
                    >
                      {invitation.role}
                    </Badge>
                    {isExpired && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Expired
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Sent {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                    </span>
                    {!isExpired && (
                      <span className="text-xs">
                        Expires {format(new Date(invitation.expires_at), 'MMM d')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResend(invitation)}
                    disabled={resendingId === invitation.id}
                  >
                    <RotateCw className={`h-4 w-4 mr-1.5 ${resendingId === invitation.id ? 'animate-spin' : ''}`} />
                    {isExpired ? 'Resend' : 'Resend'}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={revokingId === invitation.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to revoke the invitation sent to{' '}
                          <strong>{invitation.email}</strong>? They will no longer be able
                          to join using this invitation link.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRevoke(invitation)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Revoke
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
