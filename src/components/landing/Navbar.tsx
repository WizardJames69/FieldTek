import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState, memo, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

const navItems = [
  { id: "features", label: "Features" },
  { id: "ai-platform", label: "AI Platform" },
  { id: "how-it-works", label: "How It Works" },
];

export const Navbar = memo(function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = element.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: offset, behavior: "smooth" });
    }
    setMobileMenuOpen(false);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled ? "landing-nav-glass" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="font-display font-bold text-xl text-white">
          Field<span className="text-orange-500">Tek</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              {item.label}
            </button>
          ))}
          <Link to="/pricing" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Pricing
          </Link>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-white/10">
            <Link to="/auth">Sign In</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white border-0"
          >
            <Link to="/auth">Get Early Access</Link>
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-3 rounded-lg text-zinc-400 hover:text-white transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 top-16 bg-[#09090B]/95 backdrop-blur-xl z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-0 top-16 z-50 md:hidden bg-[#18181B] border-b border-zinc-800"
            >
              <div className="px-4 py-4 space-y-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="block w-full text-left py-4 px-4 text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
                <Link
                  to="/pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-left py-4 px-4 text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  Pricing
                </Link>
                <div className="pt-3 space-y-2 border-t border-zinc-800 mt-2">
                  <Button asChild variant="ghost" className="w-full justify-center text-zinc-300 hover:text-white hover:bg-white/10">
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                  </Button>
                  <Button asChild className="w-full justify-center bg-orange-500 hover:bg-orange-600 text-white">
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>Get Early Access</Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
});
