import React, { Suspense, lazy, ReactNode, forwardRef } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { PortalAuthProvider } from "@/contexts/PortalAuthContext";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { PwaUpdatePrompt } from "@/components/pwa/PwaUpdatePrompt";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionExpiryWarning } from "@/components/auth/SessionExpiryWarning";
import { RoleGuard } from "@/components/auth/RoleGuard";

// Import version and error tracking
import "@/lib/version";
import { captureError, addBreadcrumb, setTags } from "@/lib/errorTracking";

// Landing page loaded eagerly for best FCP
import Landing from "./pages/Landing";

// PDF One-Pagers
const SalesOnePager = lazy(() => import("./pages/SalesOnePager"));
const FeaturesOnePager = lazy(() => import("./pages/FeaturesOnePager"));

// All other pages lazy loaded
const BookDemo = lazy(() => import("./pages/BookDemo"));
const Contact = lazy(() => import("./pages/Contact"));
const Auth = lazy(() => import("./pages/Auth"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Clients = lazy(() => import("./pages/Clients"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Equipment = lazy(() => import("./pages/Equipment"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Team = lazy(() => import("./pages/Team"));
const Documents = lazy(() => import("./pages/Documents"));
const Settings = lazy(() => import("./pages/Settings"));
const ServiceRequests = lazy(() => import("./pages/ServiceRequests"));
const RequestService = lazy(() => import("./pages/RequestService"));
const Tutorials = lazy(() => import("./pages/Tutorials"));
const Reports = lazy(() => import("./pages/Reports"));
const MyJobs = lazy(() => import("./pages/MyJobs"));
const MyCalendar = lazy(() => import("./pages/MyCalendar"));
const BillingSuccess = lazy(() => import("./pages/BillingSuccess"));
const BillingCancel = lazy(() => import("./pages/BillingCancel"));
const PostCheckout = lazy(() => import("./pages/PostCheckout"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PortalLogin = lazy(() => import("./pages/portal/PortalLogin"));
const PortalSignup = lazy(() => import("./pages/portal/PortalSignup"));
const PortalDashboard = lazy(() => import("./pages/portal/PortalDashboard"));
const PortalJobs = lazy(() => import("./pages/portal/PortalJobs"));
const PortalInvoices = lazy(() => import("./pages/portal/PortalInvoices"));
const PortalEquipment = lazy(() => import("./pages/portal/PortalEquipment"));
const PortalRequest = lazy(() => import("./pages/portal/PortalRequest"));
const PortalProfile = lazy(() => import("./pages/portal/PortalProfile"));
const PortalPaymentSuccess = lazy(() => import("./pages/portal/PortalPaymentSuccess"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminDemoRequests = lazy(() => import("./pages/admin/AdminDemoRequests"));
const AdminTenants = lazy(() => import("./pages/admin/AdminTenants"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminDemoAnalytics = lazy(() => import("./pages/admin/AdminDemoAnalytics"));
const AdminRevenue = lazy(() => import("./pages/admin/AdminRevenue"));
const AdminTenantHealth = lazy(() => import("./pages/admin/AdminTenantHealth"));
const AdminCommunications = lazy(() => import("./pages/admin/AdminCommunications"));
const AdminOnboardingPipeline = lazy(() => import("./pages/admin/AdminOnboardingPipeline"));
const AdminWaitlist = lazy(() => import("./pages/admin/AdminWaitlist"));
const AdminAIAuditLogs = lazy(() => import("./pages/admin/AdminAIAuditLogs"));
const AdminFeedback = lazy(() => import("./pages/admin/AdminFeedback"));
const AdminUsageAnalytics = lazy(() => import("./pages/admin/AdminUsageAnalytics"));
const AdminFeatureFlags = lazy(() => import("./pages/admin/AdminFeatureFlags"));
const AdminBetaApplications = lazy(() => import("./pages/admin/AdminBetaApplications"));
const AdminSystemHealth = lazy(() => import("./pages/admin/AdminSystemHealth"));
const AdminVoiceUsage = lazy(() => import("./pages/admin/AdminVoiceUsage"));

// Demo sandbox routes
const DemoSandbox = lazy(() => import("./pages/DemoSandbox"));
const DemoLayout = lazy(() => import("./components/demo-sandbox/DemoLayout").then(m => ({ default: m.DemoLayout })));
const DemoDashboard = lazy(() => import("./pages/demo/DemoDashboard"));
const DemoJobs = lazy(() => import("./pages/demo/DemoJobs"));
const DemoInvoices = lazy(() => import("./pages/demo/DemoInvoices"));
const DemoClients = lazy(() => import("./pages/demo/DemoClients"));
const DemoSchedule = lazy(() => import("./pages/demo/DemoSchedule"));
const DemoEquipment = lazy(() => import("./pages/demo/DemoEquipment"));
const DemoAssistant = lazy(() => import("./pages/demo/DemoAssistant"));
const DemoServiceRequests = lazy(() => import("./pages/demo/DemoServiceRequests"));

// Standalone pages
const Pricing = lazy(() => import("./pages/Pricing"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const MediaKit = lazy(() => import("./pages/MediaKit"));
const Install = lazy(() => import("./pages/Install"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes
      gcTime: 10 * 60 * 1000,         // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Minimal loading fallback with forwardRef to avoid ref warnings
const PageLoader = forwardRef<HTMLDivElement>((_, ref) => <div ref={ref} />);
PageLoader.displayName = "PageLoader";

/**
 * Wrapper that provides TenantProvider context to a single element
 */
function WithTenant({ children }: { children: ReactNode }) {
  return <TenantProvider>{children}</TenantProvider>;
}

/**
 * Wrapper that provides PortalAuthProvider context to a single element
 */
function WithPortalAuth({ children }: { children: ReactNode }) {
  return <PortalAuthProvider>{children}</PortalAuthProvider>;
}

/**
 * Layout wrapper for portal routes - provides context and renders Outlet
 */
function PortalLayout() {
  return (
    <PortalAuthProvider>
      <Outlet />
    </PortalAuthProvider>
  );
}

/**
 * Layout wrapper for tenant routes - provides context and renders Outlet
 */
function TenantLayout() {
  return (
    <TenantProvider>
      <Outlet />
    </TenantProvider>
  );
}

// Error handler integrated with error tracking system
const handleAppError = (error: Error, errorInfo: React.ErrorInfo) => {
  // Capture with full context via error tracking system
  captureError(error, {
    severity: 'fatal',
    componentStack: errorInfo.componentStack || undefined,
    tags: { boundary: 'root' },
    extra: {
      componentStack: errorInfo.componentStack?.split('\n').slice(0, 10).join('\n'),
    },
  });
};

// Set app-level tags
setTags({
  app: 'fieldtek',
  version: import.meta.env.VITE_APP_VERSION || 'dev',
});

// Add app init breadcrumb
addBreadcrumb({
  type: 'state',
  category: 'app',
  message: 'App component mounted',
});

function App() {
  return (
    <HelmetProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange={false}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TooltipProvider>
              <AuthProvider>
                <ImpersonationProvider>
                  <ErrorBoundary onError={handleAppError}>
                    <SessionExpiryWarning />
                    <Toaster />
                    <Sonner />
                    <InstallPrompt />
                    <PwaUpdatePrompt />
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        {/* Public routes */}
                        <Route path="/" element={<Landing />} />
                        <Route path="/pricing" element={<Pricing />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/consultation" element={<BookDemo />} />
                        <Route path="/book-demo" element={<BookDemo />} /> {/* Legacy redirect */}
                        <Route path="/auth" element={<Auth />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/verify-email" element={<VerifyEmail />} />
                        <Route path="/accept-invite" element={<AcceptInvite />} />
                        
                        {/* Blog routes - no auth required */}
                        <Route path="/blog" element={<Blog />} />
                        <Route path="/blog/:slug" element={<BlogPost />} />
                        
                        {/* PDF One-Pager routes - no auth required */}
                        <Route path="/one-pager/sales" element={<SalesOnePager />} />
                        <Route path="/one-pager/features" element={<FeaturesOnePager />} />
                        <Route path="/media-kit" element={<MediaKit />} />
                        <Route path="/install" element={<Install />} />
                        
                        {/* Demo Sandbox routes - no auth required */}
                        <Route path="/demo-sandbox" element={<DemoSandbox />} />
                        <Route path="/demo" element={<DemoLayout />}>
                          <Route index element={<DemoDashboard />} />
                          <Route path="dashboard" element={<DemoDashboard />} />
                          <Route path="jobs" element={<DemoJobs />} />
                          <Route path="invoices" element={<DemoInvoices />} />
                          <Route path="clients" element={<DemoClients />} />
                          <Route path="schedule" element={<DemoSchedule />} />
                          <Route path="equipment" element={<DemoEquipment />} />
                          <Route path="assistant" element={<DemoAssistant />} />
                          <Route path="requests" element={<DemoServiceRequests />} />
                        </Route>
                        
                        {/* Admin routes - NO TenantProvider */}
                        <Route path="/admin/login" element={<AdminLogin />} />
                        <Route path="/admin" element={<AdminLayout />}>
                          <Route index element={<AdminDashboard />} />
                          <Route path="onboarding-pipeline" element={<AdminOnboardingPipeline />} />
                          <Route path="demo-requests" element={<AdminDemoRequests />} />
                          <Route path="demo-analytics" element={<AdminDemoAnalytics />} />
                          <Route path="tenants" element={<AdminTenants />} />
                          <Route path="analytics" element={<AdminAnalytics />} />
                          <Route path="revenue" element={<AdminRevenue />} />
                          <Route path="tenant-health" element={<AdminTenantHealth />} />
                          <Route path="communications" element={<AdminCommunications />} />
                          <Route path="waitlist" element={<AdminWaitlist />} />
                          <Route path="ai-audit" element={<AdminAIAuditLogs />} />
                          <Route path="feedback" element={<AdminFeedback />} />
                          <Route path="usage-analytics" element={<AdminUsageAnalytics />} />
                          <Route path="feature-flags" element={<AdminFeatureFlags />} />
                          <Route path="beta-applications" element={<AdminBetaApplications />} />
                          <Route path="system-health" element={<AdminSystemHealth />} />
                          <Route path="voice-usage" element={<AdminVoiceUsage />} />
                        </Route>
                        
                        {/* Portal routes - own auth context */}
                        <Route element={<PortalLayout />}>
                          <Route path="/portal/login" element={<PortalLogin />} />
                          <Route path="/portal/signup" element={<PortalSignup />} />
                          <Route path="/portal" element={<PortalDashboard />} />
                          <Route path="/portal/jobs" element={<PortalJobs />} />
                          <Route path="/portal/invoices" element={<PortalInvoices />} />
                          <Route path="/portal/equipment" element={<PortalEquipment />} />
                          <Route path="/portal/request" element={<PortalRequest />} />
                          <Route path="/portal/profile" element={<PortalProfile />} />
                          <Route path="/portal/payment-success" element={<PortalPaymentSuccess />} />
                        </Route>
                        
                        {/* Tenant app routes - with TenantProvider */}
                        <Route element={<TenantLayout />}>
                          <Route path="/onboarding" element={<Onboarding />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/jobs" element={<Jobs />} />
                          <Route path="/clients" element={<RoleGuard allowedRoles={['owner', 'admin', 'dispatcher']}><Clients /></RoleGuard>} />
                          <Route path="/schedule" element={<Schedule />} />
                          <Route path="/assistant" element={<Assistant />} />
                          <Route path="/equipment" element={<Equipment />} />
                          <Route path="/invoices" element={<RoleGuard allowedRoles={['owner', 'admin', 'dispatcher']}><Invoices /></RoleGuard>} />
                          <Route path="/team" element={<RoleGuard allowedRoles={['owner', 'admin']}><Team /></RoleGuard>} />
                          <Route path="/documents" element={<Documents />} />
                          <Route path="/settings" element={<RoleGuard allowedRoles={['owner', 'admin']}><Settings /></RoleGuard>} />
                          <Route path="/requests" element={<ServiceRequests />} />
                          <Route path="/request-service" element={<RequestService />} />
                          <Route path="/reports" element={<RoleGuard allowedRoles={['owner', 'admin']}><Reports /></RoleGuard>} />
                          <Route path="/my-jobs" element={<MyJobs />} />
                          <Route path="/my-calendar" element={<MyCalendar />} />
                          <Route path="/billing/success" element={<BillingSuccess />} />
                          <Route path="/billing/cancel" element={<BillingCancel />} />
                          <Route path="/post-checkout" element={<PostCheckout />} />
                          <Route path="/tutorials" element={<Tutorials />} />
                        </Route>
                        
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </ErrorBoundary>
                </ImpersonationProvider>
              </AuthProvider>
            </TooltipProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
