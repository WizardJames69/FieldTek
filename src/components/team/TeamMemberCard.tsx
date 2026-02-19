import { useState, memo, useCallback, useMemo } from 'react';
import { MoreVertical, Shield, Mail, Phone, Clock, UserX, Edit2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface TeamMember {
  id: string;
  user_id: string;
  role: AppRole;
  is_active: boolean;
  joined_at: string | null;
  invited_at: string | null;
  profile?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
}

interface TeamMemberCardProps {
  member: TeamMember;
  currentUserRole: AppRole | null;
  currentUserId: string | undefined;
  onUpdate: () => void;
}

const roleColors: Record<AppRole, string> = {
  owner: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  admin: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  dispatcher: 'bg-green-500/10 text-green-500 border-green-500/20',
  technician: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  client: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export const TeamMemberCard = memo(function TeamMemberCard({ 
  member, 
  currentUserRole, 
  currentUserId, 
  onUpdate 
}: TeamMemberCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>(member.role);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Memoize computed values
  const isCurrentUser = member.user_id === currentUserId;
  const canManage = currentUserRole === 'owner' || (currentUserRole === 'admin' && member.role !== 'owner');
  const isPending = !member.is_active;

  const { displayName, initials } = useMemo(() => {
    const name = member.profile?.full_name || member.profile?.email?.split('@')[0] || 'Unknown User';
    const init = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return { displayName: name, initials: init };
  }, [member.profile?.full_name, member.profile?.email]);

  const formattedDate = useMemo(() => {
    if (member.joined_at) {
      return `Joined ${format(new Date(member.joined_at), 'MMM d, yyyy')}`;
    }
    if (member.invited_at) {
      return `Invited ${format(new Date(member.invited_at), 'MMM d, yyyy')}`;
    }
    return 'No date available';
  }, [member.joined_at, member.invited_at]);

  const handleRoleChange = useCallback(async (newRole: AppRole) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('tenant_users')
        .update({ role: newRole })
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: 'Role updated',
        description: `Role has been changed to ${newRole}`,
      });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update role',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [member.id, toast, onUpdate]);

  const handleDeactivate = useCallback(async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('tenant_users')
        .update({ is_active: false })
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: 'Member deactivated',
        description: 'Team member has been deactivated',
      });
      onUpdate();
    } catch (error) {
      console.error('Error deactivating member:', error);
      toast({
        title: 'Error',
        description: 'Failed to deactivate member',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [member.id, toast, onUpdate]);

  const handleReactivate = useCallback(async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('tenant_users')
        .update({ is_active: true })
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: 'Member reactivated',
        description: 'Team member has been reactivated',
      });
      onUpdate();
    } catch (error) {
      console.error('Error reactivating member:', error);
      toast({
        title: 'Error',
        description: 'Failed to reactivate member',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [member.id, toast, onUpdate]);

  const startEditing = useCallback(() => setIsEditing(true), []);
  const cancelEditing = useCallback(() => setIsEditing(false), []);
  const saveRole = useCallback(() => handleRoleChange(selectedRole), [handleRoleChange, selectedRole]);

  return (
    <Card className={`transition-all ${!member.is_active ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={member.profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">{displayName}</h3>
              {isCurrentUser && (
                <Badge variant="outline" className="text-xs">You</Badge>
              )}
              {isPending && (
                <Badge variant="secondary" className="text-xs">Pending</Badge>
              )}
            </div>

            {isEditing ? (
              <div className="flex items-center gap-2 mt-2">
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentUserRole === 'owner' && <SelectItem value="admin">Admin</SelectItem>}
                    <SelectItem value="dispatcher">Dispatcher</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={saveRole} disabled={isLoading}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEditing}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Badge variant="outline" className={`${roleColors[member.role]} capitalize`}>
                <Shield className="h-3 w-3 mr-1" />
                {member.role}
              </Badge>
            )}

            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              {member.profile?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{member.profile.email}</span>
                </div>
              )}
              {member.profile?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{member.profile.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>

          {canManage && !isCurrentUser && member.role !== 'owner' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={startEditing}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Change Role
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {member.is_active ? (
                  <DropdownMenuItem onClick={handleDeactivate} className="text-destructive">
                    <UserX className="h-4 w-4 mr-2" />
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleReactivate}>
                    <Shield className="h-4 w-4 mr-2" />
                    Reactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
