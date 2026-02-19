import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Calendar,
  Building2,
  BarChart3,
  DollarSign,
  HeartPulse,
  MessageSquare,
  GitBranch,
  LogOut,
  Menu,
  X,
  Volume2,
  ShieldX,
  ArrowLeft,
  ClipboardList,
  MessageSquarePlus,
  TrendingUp,
  Flag,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { checkIsPlatformAdmin } from "@/lib/authRouting";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { label: "Onboarding Pipeline", icon: GitBranch, path: "/admin/onboarding-pipeline" },
  { label: "Demo Requests", icon: Calendar, path: "/admin/demo-requests" },
  { label: "Beta Applications", icon: FlaskConical, path: "/admin/beta-applications" },
  { label: "AI Demo Analytics", icon: Volume2, path: "/admin/demo-analytics" },
  { label: "AI Audit Logs", icon: ShieldX, path: "/admin/ai-audit" },
  { label: "Beta Feedback", icon: MessageSquarePlus, path: "/admin/feedback" },
  { label: "Waitlist", icon: ClipboardList, path: "/admin/waitlist" },
  { label: "Tenants", icon: Building2, path: "/admin/tenants" },
  { label: "Analytics", icon: BarChart3, path: "/admin/analytics" },
  { label: "Usage Analytics", icon: TrendingUp, path: "/admin/usage-analytics" },
  { label: "Revenue", icon: DollarSign, path: "/admin/revenue" },
  { label: "Tenant Health", icon: HeartPulse, path: "/admin/tenant-health" },
  { label: "System Health", icon: HeartPulse, path: "/admin/system-health" },
  { label: "Communications", icon: MessageSquare, path: "/admin/communications" },
  { label: "Voice Usage", icon: Volume2, path: "/admin/voice-usage" },
  { label: "Feature Flags", icon: Flag, path: "/admin/feature-flags" },
];

type AdminState = "loading" | "authenticated" | "unauthenticated" | "denied";

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminState, setAdminState] = useState<AdminState>("loading");

  useEffect(() => {
    const checkAccess = async () => {
      // Wait for auth to finish loading
      if (authLoading) return;

      // Not logged in at all
      if (!user) {
        setAdminState("unauthenticated");
        return;
      }

      // Check platform admin status
      const result = await checkIsPlatformAdmin();
      
      if (result.error) {
        console.error("Admin check error:", result.error);
        // On error, show denied state (could also retry)
        setAdminState("denied");
        return;
      }

      if (result.isAdmin) {
        setAdminState("authenticated");
      } else {
        setAdminState("denied");
      }
    };

    checkAccess();
  }, [authLoading, user]);

  // Handle redirects based on state
  useEffect(() => {
    if (adminState === "unauthenticated") {
      navigate("/admin/login", { replace: true });
    }
  }, [adminState, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  // Loading state
  if (adminState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Access denied state - show explicit error
  if (adminState === "denied") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md text-center space-y-6 bg-card border border-border rounded-2xl shadow-xl p-8">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Access Denied</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You do not have platform administrator privileges.
            </p>
          </div>
          <div className="space-y-3">
            <Button
              onClick={() => navigate("/admin/login")}
              className="w-full gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Admin Login
            </Button>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="w-full gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated - will redirect, show nothing
  if (adminState === "unauthenticated") {
    return null;
  }

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen bg-muted/30">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-background border-b z-50 flex items-center px-4">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <span className="ml-3 font-semibold text-lg">FieldTek Admin</span>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-screen w-64 bg-card border-r transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full pt-16 lg:pt-0">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b shrink-0">
            <span className="text-xl font-bold text-primary">FieldTek</span>
            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              Admin
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t">
            <div className="text-sm text-muted-foreground mb-3 px-2">
              {user?.email}
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Main content */}
      <main className="lg:pl-64 pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
    </>
  );
}
