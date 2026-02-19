import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import confetti from "canvas-confetti";

export default function PortalPaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invoiceId = searchParams.get("invoice");
  const [invoice, setInvoice] = useState<{
    invoice_number: string;
    total: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Trigger confetti animation
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#22c55e", "#16a34a", "#15803d"],
    });

    // Fetch invoice details
    const fetchInvoice = async () => {
      if (!invoiceId) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("invoices")
        .select("invoice_number, total")
        .eq("id", invoiceId)
        .maybeSingle();

      if (data) {
        setInvoice(data);
      }
      setIsLoading(false);
    };

    fetchInvoice();
  }, [invoiceId]);

  return (
    <PortalLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mb-6">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Payment Successful!
              </h1>
              <p className="text-muted-foreground">
                Thank you for your payment. Your invoice has been marked as paid.
              </p>
            </div>

            {isLoading ? (
              <div className="py-6">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : invoice ? (
              <div className="bg-muted/50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Invoice</span>
                </div>
                <p className="font-semibold text-lg text-foreground">
                  {invoice.invoice_number}
                </p>
                <p className="text-2xl font-bold text-success mt-1">
                  ${Number(invoice.total).toFixed(2)}
                </p>
              </div>
            ) : null}

            <div className="space-y-3">
              <Button
                onClick={() => navigate("/portal/invoices")}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Invoices
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/portal")}
                className="w-full"
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
