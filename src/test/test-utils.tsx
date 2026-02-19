import React, { ReactElement } from "react";
import { render as rtlRender, RenderOptions } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

// Re-export everything from testing-library
export * from "@testing-library/react";

// Create a fresh QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface AllProvidersProps {
  children: React.ReactNode;
}

function AllProviders({ children }: AllProvidersProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <BrowserRouter>
          {children}
          <Toaster />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) => rtlRender(ui, { wrapper: AllProviders, ...options });

// Override render with custom render
export { customRender as render };

// Mock user for authenticated tests
export const mockAuthenticatedUser = {
  id: "test-user-123",
  email: "test@example.com",
  user_metadata: {
    full_name: "Test User",
  },
};

// Mock tenant for tenant-scoped tests
export const mockTenant = {
  id: "test-tenant-123",
  name: "Test Company",
  slug: "test-company",
  subscription_tier: "professional",
  subscription_status: "active",
};

// Mock job for job-related tests
export const mockJob = {
  id: "test-job-123",
  title: "AC Repair",
  status: "pending",
  priority: "medium",
  tenant_id: "test-tenant-123",
  scheduled_date: "2026-02-01",
  scheduled_time: "09:00",
  description: "Air conditioning not cooling",
  address: "123 Main St",
  client: {
    id: "test-client-123",
    name: "John Doe",
    email: "john@example.com",
    phone: "555-1234",
  },
};

// Mock client for client-related tests
export const mockClient = {
  id: "test-client-123",
  name: "John Doe",
  email: "john@example.com",
  phone: "555-1234",
  address: "123 Main St",
  city: "Anytown",
  state: "CA",
  zip_code: "12345",
  tenant_id: "test-tenant-123",
};

// Mock invoice for invoice-related tests
export const mockInvoice = {
  id: "test-invoice-123",
  invoice_number: "INV-001",
  status: "draft",
  subtotal: 500,
  tax_amount: 50,
  total: 550,
  due_date: "2026-02-15",
  tenant_id: "test-tenant-123",
  client_id: "test-client-123",
  client: mockClient,
};
