import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Button } from '@/components/ui/button';
import { X, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedTenant, stopImpersonation } = useImpersonation();
  const navigate = useNavigate();

  if (!isImpersonating || !impersonatedTenant) {
    return null;
  }

  const handleStopAndReturn = () => {
    stopImpersonation();
    navigate('/admin/tenants');
  };

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-4 text-sm font-medium">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span>
          Viewing as tenant: <strong>{impersonatedTenant.tenant.name}</strong>
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleStopAndReturn}
        className="bg-amber-100 border-amber-600 text-amber-900 hover:bg-amber-200 h-7"
      >
        <X className="h-3 w-3 mr-1" />
        Exit Impersonation
      </Button>
    </div>
  );
}
