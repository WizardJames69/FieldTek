import { useState } from 'react';
import { format } from 'date-fns';
import {
  FileText,
  Search,
  Filter,
  DollarSign,
  Send,
  Download,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDemoSandbox } from '@/contexts/DemoSandboxContext';
import { useTerminologyWithIndustry } from '@/hooks/useTerminology';
import { toast } from '@/hooks/use-toast';

export default function DemoInvoices() {
  const { getDemoInvoices, getDemoInvoiceLineItems, getDemoClients, industry } = useDemoSandbox();
  const { t } = useTerminologyWithIndustry(industry);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  const invoices = getDemoInvoices();
  const clients = getDemoClients();

  const filteredInvoices = invoices.filter(invoice => {
    const client = clients.find(c => c.id === invoice.client_id);
    const matchesSearch = invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedInvoiceData = invoices.find(i => i.id === selectedInvoice);
  const selectedInvoiceClient = selectedInvoiceData ? clients.find(c => c.id === selectedInvoiceData.client_id) : null;
  const selectedInvoiceLineItems = selectedInvoice ? getDemoInvoiceLineItems(selectedInvoice) : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'default';
      case 'sent': return 'secondary';
      case 'overdue': return 'destructive';
      case 'draft': return 'outline';
      default: return 'outline';
    }
  };

  // Stats
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0);
  const totalPending = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((sum, i) => sum + (i.total || 0), 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  return (
    <div className="space-y-4 md:space-y-6" data-tour="invoices-list">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Manage billing and payments</p>
        </div>
        <Button 
          onClick={() => toast({
            title: "Demo Mode",
            description: "In the full app, you can create invoices from jobs or scratch. Sign up to try it!",
          })}
          data-tour="create-invoice"
        >
          <FileText className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className="text-2xl font-bold text-green-600">${totalPaid.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">${totalPending.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-600/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{overdueCount} invoices</p>
              </div>
              <DollarSign className="h-8 w-8 text-red-600/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 md:pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Invoice Cards */}
      <div className="space-y-3 md:hidden">
        {filteredInvoices.map(invoice => {
          const client = clients.find(c => c.id === invoice.client_id);
          return (
            <Card
              key={invoice.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedInvoice(invoice.id)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{invoice.invoice_number}</span>
                      <Badge variant={getStatusColor(invoice.status) as any} className="capitalize">
                        {invoice.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {client?.name || 'Unknown'}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{format(new Date(invoice.created_at), 'MMM d, yyyy')}</span>
                      {invoice.due_date && (
                        <>
                          <span>•</span>
                          <span>Due {format(new Date(invoice.due_date), 'MMM d')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">${(invoice.total || 0).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredInvoices.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No invoices found
            </CardContent>
          </Card>
        )}
      </div>

      {/* Desktop Invoices Table */}
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>{t('client')}</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.map(invoice => {
              const client = clients.find(c => c.id === invoice.client_id);
              return (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedInvoice(invoice.id)}
                >
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>{client?.name || 'Unknown'}</TableCell>
                  <TableCell>{format(new Date(invoice.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(invoice.status) as any} className="capitalize">
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${(invoice.total || 0).toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Invoice Detail Sheet */}
      <Sheet open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedInvoiceData && (
            <>
              <SheetHeader>
                <SheetTitle>Invoice {selectedInvoiceData.invoice_number}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <Badge variant={getStatusColor(selectedInvoiceData.status) as any} className="capitalize">
                    {selectedInvoiceData.status}
                  </Badge>
                  <span className="text-2xl font-bold">
                    ${(selectedInvoiceData.total || 0).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">{t('client')}</h4>
                    <p className="font-medium">{selectedInvoiceClient?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedInvoiceClient?.email}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Invoice Date</h4>
                      <p>{format(new Date(selectedInvoiceData.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Due Date</h4>
                      <p>{selectedInvoiceData.due_date ? format(new Date(selectedInvoiceData.due_date), 'MMM d, yyyy') : '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Line Items</h4>
                  <div className="space-y-2">
                    {selectedInvoiceLineItems.map(item => (
                      <div key={item.id} className="flex justify-between py-2 border-b">
                        <div>
                          <p className="font-medium">{item.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} × ${item.unit_price.toFixed(2)}
                          </p>
                        </div>
                        <p className="font-medium">${item.total.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between pt-4 font-bold">
                    <span>Total</span>
                    <span>${(selectedInvoiceData.total || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button className="flex-1" onClick={() => toast({
                    title: "Demo Mode",
                    description: "In the full app, invoices are emailed directly to customers with payment links. Sign up to try it!",
                  })}>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => toast({
                    title: "Demo Mode",
                    description: "In the full app, you can download professional PDF invoices. Sign up to try it!",
                  })}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
