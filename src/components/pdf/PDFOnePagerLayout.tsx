import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import fieldtekLogo from '@/assets/fieldtek-logo.png';

interface PDFOnePagerLayoutProps {
  children: ReactNode;
  documentType: string;
  contactInfo?: {
    website: string;
    email: string;
    phone: string;
  };
}

const defaultContactInfo = {
  website: 'fieldtek.ai',
  email: 'info@fieldtek.ai',
  phone: '(555) 123-4567'
};

export function PDFOnePagerLayout({ 
  children, 
  documentType,
  contactInfo = defaultContactInfo 
}: PDFOnePagerLayoutProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Print-optimized styles */}
      <style>
        {`
          @media print {
            @page { 
              margin: 0.4in; 
              size: letter portrait;
            }
            
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            .no-print {
              display: none !important;
            }
            
            .print-page {
              page-break-inside: avoid;
              box-shadow: none !important;
              border: none !important;
            }
          }
          
          @media screen {
            .print-page {
              max-width: 8.5in;
              min-height: 11in;
              margin: 0 auto;
              background: white;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            }
          }
        `}
      </style>

      {/* Download/Print Controls - Hidden when printing */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <Button onClick={handlePrint} size="sm" variant="outline" className="bg-white shadow-md">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        <Button onClick={handlePrint} size="sm" className="shadow-md">
          <Download className="h-4 w-4 mr-2" />
          Save as PDF
        </Button>
      </div>

      {/* Back to site link - Hidden when printing */}
      <div className="no-print fixed top-4 left-4 z-50">
        <Button variant="ghost" size="sm" asChild className="bg-white/80 backdrop-blur shadow-sm">
          <a href="/">← Back to Site</a>
        </Button>
      </div>

      {/* Page Container */}
      <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:p-0">
        <div className="print-page bg-white p-8 print:p-0">
          {/* Header */}
          <header className="flex items-center justify-between pb-4 mb-6 border-b-2 border-orange-500">
            <div className="flex items-center gap-3">
              <img 
                src={fieldtekLogo} 
                alt="FieldTek Logo" 
                className="h-10 w-auto"
              />
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                {documentType}
              </span>
            </div>
          </header>

          {/* Main Content */}
          <main className="space-y-6">
            {children}
          </main>

          {/* Footer */}
          <footer className="mt-8 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span>{contactInfo.website}</span>
                <span>{contactInfo.email}</span>
                <span>{contactInfo.phone}</span>
              </div>
              <div>
                © {new Date().getFullYear()} FieldTek. All rights reserved.
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
