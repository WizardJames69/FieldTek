import { Link } from 'react-router-dom';
import { ClipboardPlus, UserPlus, ReceiptText, Upload, type LucideIcon } from 'lucide-react';
import { useTerminology } from '@/hooks/useTerminology';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

type QuickAction = {
  label: string;
  to: string;
  icon: LucideIcon;
};

/**
 * One-tap create shortcuts into the `?action=new` deep links wired in
 * PR-APP-1. Pure navigation: no queries, no mutations. Rendered only on the
 * owner/admin/dispatcher dashboard; the invoice shortcut follows the same
 * feature gate as the /invoices route.
 */
export function QuickActions() {
  const { t } = useTerminology();
  const { hasAccess } = useFeatureAccess();

  const actions: QuickAction[] = [
    { label: `New ${t('job')}`, to: '/jobs?action=new', icon: ClipboardPlus },
    { label: 'New Client', to: '/clients?action=new', icon: UserPlus },
    ...(hasAccess('invoicing_full')
      ? [{ label: 'New Invoice', to: '/invoices?action=new', icon: ReceiptText }]
      : []),
    { label: 'Upload Document', to: '/documents?action=new', icon: Upload },
  ];

  return (
    <nav
      aria-label="Quick actions"
      className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4"
      data-testid="dashboard-quick-actions"
    >
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.to}
            to={action.to}
            className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-card touch-native transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] active:shadow-md"
          >
            <span className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium truncate">{action.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
