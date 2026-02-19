import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Users, Shield, UserCheck, UserX, Search, Filter } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant, useUserRole } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { InviteUserDialog } from '@/components/team/InviteUserDialog';
import { TeamMemberCard } from '@/components/team/TeamMemberCard';
import { PendingInvitationsList } from '@/components/team/PendingInvitationsList';
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

export default function Team() {
  const { user, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const { role, isAdmin, isOwner } = useUserRole();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('active');

  const fetchTeamMembers = async () => {
    if (!tenant?.id) return;

    setLoading(true);
    try {
      const { data: tenantUsers, error: tuError } = await supabase
        .from('tenant_users')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (tuError) throw tuError;

      // Fetch profiles for all users
      const userIds = tenantUsers?.map(tu => tu.user_id) || [];
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone, avatar_url')
        .in('user_id', userIds);

      if (pError) throw pError;

      // Merge data
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]));
      const merged: TeamMember[] = (tenantUsers || []).map(tu => ({
        ...tu,
        profile: profileMap.get(tu.user_id) || null,
      }));

      setMembers(merged);
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenant?.id) {
      fetchTeamMembers();
    }
  }, [tenant?.id]);

  // Redirect if not authenticated or not admin
  if (authLoading || tenantLoading) {
    return (
      <MainLayout title="Team Management">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin && !isOwner) {
    return <Navigate to="/dashboard" replace />;
  }

  // Filter members
  const filteredMembers = members.filter(member => {
    const matchesSearch = searchQuery === '' || 
      member.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    const matchesStatus = activeTab === 'active' ? member.is_active : !member.is_active;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Stats
  const activeCount = members.filter(m => m.is_active).length;
  const pendingCount = members.filter(m => !m.is_active).length;
  const adminCount = members.filter(m => ['owner', 'admin'].includes(m.role) && m.is_active).length;
  const techCount = members.filter(m => m.role === 'technician' && m.is_active).length;

  return (
    <MainLayout 
      title="Team Management" 
      subtitle="Manage your team members and their roles"
      actions={<InviteUserDialog onInviteSent={fetchTeamMembers} />}
    >
      <div className="space-y-4 md:space-y-6">
        {/* Pending Invitations */}
        <PendingInvitationsList onInvitationChange={fetchTeamMembers} />
        {/* Stats Cards - Phase 5: Enhanced with glass effect */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card className="stat-card-glass overflow-hidden border-primary/20">
            <CardContent className="p-4 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <div className="flex items-center gap-3 relative">
                <div className="p-2 rounded-lg bg-primary/10 backdrop-blur-sm">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeCount}</p>
                  <p className="text-sm text-muted-foreground">Active Members</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card-glass overflow-hidden border-orange-500/20">
            <CardContent className="p-4 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
              <div className="flex items-center gap-3 relative">
                <div className="p-2 rounded-lg bg-orange-500/10 backdrop-blur-sm">
                  <UserX className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card-glass overflow-hidden border-blue-500/20">
            <CardContent className="p-4 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
              <div className="flex items-center gap-3 relative">
                <div className="p-2 rounded-lg bg-blue-500/10 backdrop-blur-sm">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{adminCount}</p>
                  <p className="text-sm text-muted-foreground">Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card-glass overflow-hidden border-green-500/20">
            <CardContent className="p-4 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
              <div className="flex items-center gap-3 relative">
                <div className="p-2 rounded-lg bg-green-500/10 backdrop-blur-sm">
                  <UserCheck className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{techCount}</p>
                  <p className="text-sm text-muted-foreground">Technicians</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters - Phase 5: Glass filter card */}
        <Card className="backdrop-blur-sm bg-card/80">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="dispatcher">Dispatcher</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="active">
              Active ({activeCount})
            </TabsTrigger>
            <TabsTrigger value="inactive">
              Inactive ({pendingCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-40" />
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  {/* Phase 5: Enhanced empty state */}
                  <div className="relative w-12 h-12 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-xl" />
                    <div className="relative flex items-center justify-center empty-state-glow">
                      <Users className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">No team members found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery || roleFilter !== 'all' 
                      ? 'Try adjusting your filters'
                      : 'Start by inviting team members'
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 list-none p-0 m-0" role="list" aria-label="Active team members">
                {filteredMembers.map((member) => (
                  <li key={member.id}>
                    <TeamMemberCard
                      member={member}
                      currentUserRole={role}
                      currentUserId={user?.id}
                      onUpdate={fetchTeamMembers}
                    />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="inactive" className="mt-4">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-40" />
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <UserX className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No inactive members</h3>
                  <p className="text-muted-foreground">
                    All team members are currently active
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 list-none p-0 m-0" role="list" aria-label="Inactive team members">
                {filteredMembers.map((member) => (
                  <li key={member.id}>
                    <TeamMemberCard
                      member={member}
                      currentUserRole={role}
                      currentUserId={user?.id}
                      onUpdate={fetchTeamMembers}
                    />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
