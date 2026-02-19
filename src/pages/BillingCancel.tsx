import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, CreditCard } from "lucide-react";

export default function BillingCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <XCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>Checkout Canceled</CardTitle>
          <CardDescription>
            Your subscription upgrade was not completed. No charges were made.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>
              Changed your mind? No problem! You can upgrade anytime from the billing settings.
              Your current plan remains active.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => navigate("/settings?tab=billing")}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Back to Billing
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
