import { useSearchParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { ServiceRequestForm } from '@/components/requests/ServiceRequestForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RequestService() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenant');
  const tenantName = searchParams.get('name') || 'Service Provider';

  if (!tenantId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-bold mb-2">Invalid Link</h2>
            <p className="text-muted-foreground">
              This service request form requires a valid company link.
              Please contact your service provider for the correct URL.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">{tenantName}</h1>
          <p className="text-muted-foreground mt-2">
            Submit a service request and we'll get back to you soon
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Request Service</CardTitle>
            <CardDescription>
              Fill out the form below to submit your service request
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ServiceRequestForm tenantId={tenantId} tenantName={tenantName} />
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Powered by FieldTek
        </p>
      </div>
    </div>
  );
}
