import { Link } from "react-router-dom";

export function Footer() {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = element.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: offset, behavior: "smooth" });
    }
  };

  return (
    <footer className="bg-[#09090B] py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="font-display font-bold text-xl mb-4">
              <span className="text-white">Field</span>
              <span className="text-orange-500">Tek</span>
            </div>
            <p className="text-sm text-zinc-500 leading-relaxed">
              AI-powered field service platform for HVAC, electrical, plumbing, and mechanical contractors.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-zinc-300 mb-4 text-sm">Product</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              <li>
                <button onClick={() => scrollToSection("features")} className="hover:text-zinc-300 transition-colors text-left">
                  Features
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection("ai-platform")} className="hover:text-zinc-300 transition-colors text-left">
                  AI Platform
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection("how-it-works")} className="hover:text-zinc-300 transition-colors text-left">
                  How It Works
                </button>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-zinc-300 transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-zinc-300 mb-4 text-sm">Company</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              <li>
                <Link to="/contact" className="hover:text-zinc-300 transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-zinc-300 transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-zinc-300 mb-4 text-sm">Legal</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              <li>
                <span className="text-zinc-600">Privacy Policy</span>
              </li>
              <li>
                <span className="text-zinc-600">Terms of Service</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-zinc-600">
            © {new Date().getFullYear()} FieldTek. All rights reserved.
          </p>
          <Link to="/admin/login" className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
