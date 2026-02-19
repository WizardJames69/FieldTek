import { Link } from "react-router-dom";

export function Footer() {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = 60;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <footer className="bg-muted/50 border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center mb-4">
              <span className="font-display font-bold text-xl">
                <span className="text-foreground">Field</span>
                <span className="text-primary">Tek</span>
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              All-in-one field service management software for modern service companies.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <button 
                  onClick={() => scrollToSection('features')} 
                  className="hover:text-foreground transition-colors text-left"
                >
                  Features
                </button>
              </li>
              <li>
                <button 
                  onClick={() => scrollToSection('pricing')} 
                  className="hover:text-foreground transition-colors text-left"
                >
                  Pricing
                </button>
              </li>
              <li>
                <Link to="/demo-sandbox" className="hover:text-foreground transition-colors">
                  Interactive Demo
                </Link>
              </li>
              <li>
                <button 
                  onClick={() => scrollToSection('roi')} 
                  className="hover:text-foreground transition-colors text-left"
                >
                  ROI Calculator
                </button>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/contact" className="hover:text-foreground transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <a href="/consultation" className="hover:text-foreground transition-colors">
                  Schedule Consultation
                </a>
              </li>
              <li>
                <Link to="/register" className="hover:text-foreground transition-colors">
                  Join Waitlist
                </Link>
              </li>
              <li>
                <button 
                  onClick={() => scrollToSection('beta-program')} 
                  className="hover:text-foreground transition-colors text-left"
                >
                  Beta Program
                </button>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="/consultation" className="hover:text-foreground transition-colors">
                  Schedule Consultation
                </a>
              </li>
              <li>
                <button 
                  onClick={() => scrollToSection('faq')} 
                  className="hover:text-foreground transition-colors text-left"
                >
                  FAQ
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} FieldTek. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground items-center">
            <span className="text-muted-foreground/50">Privacy Policy</span>
            <span className="text-muted-foreground/50">Terms of Service</span>
            <Link to="/admin/login" className="text-muted-foreground/30 text-xs hover:text-muted-foreground transition-colors">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
