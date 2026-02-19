import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Menu, X, ChevronRight, Sparkles, FlaskConical } from "lucide-react";
import { useState, memo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "./ThemeToggle";

export const Navbar = memo(function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll position for glass effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const navbarHeight = 72; // Height of fixed navbar
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - navbarHeight - 16; // Extra 16px padding
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
    setMobileMenuOpen(false);
  }, []);

  const navItems = [
    { id: 'features', label: 'Features' },
    { id: 'demo', label: 'Demo' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'roi', label: 'ROI Calculator' },
    { id: 'blog', label: 'Blog', href: '/blog' },
    { id: 'contact', label: 'Contact', href: '/contact' },
  ];

  return (
    <nav 
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled 
          ? 'glass-navbar shadow-sm' 
          : 'bg-background/0 border-b border-transparent'
      }`}
    >
      <div className="container mx-auto px-4 h-[72px] py-4">
        <div className="flex items-center justify-between h-full">
          {/* Logo */}
          <Link to="/" className="group flex items-center gap-2">
            <span className="font-display font-bold text-xl group-hover:tracking-wide transition-all duration-200 origin-left">
              <span className="text-foreground">Field</span>
              <span className="text-primary">Tek</span>
            </span>
            <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-wide">
              Beta
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              'href' in item && item.href ? (
                <Link
                  key={item.id}
                  to={item.href}
                  className="relative text-muted-foreground hover:text-foreground transition-colors text-sm font-medium group"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full" />
                </Link>
              ) : (
                <button 
                  key={item.id}
                  onClick={() => scrollToSection(item.id)} 
                  className="relative text-muted-foreground hover:text-foreground transition-colors text-sm font-medium group"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full" />
                </button>
              )
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            <Button 
              variant="outline" 
              size="sm" 
              className="border-primary/50 text-primary hover:bg-primary/10"
              onClick={() => scrollToSection('beta-program')}
            >
              <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
              Join Beta
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild size="sm" className="shadow-sm">
              <Link to="/demo-sandbox">Try Demo</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2.5 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 hover:bg-muted/80 transition-all active:scale-95"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileMenuOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="h-5 w-5 text-foreground" />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Menu className="h-5 w-5 text-foreground" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Mobile Menu - Floating Card Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop - fully opaque to block content */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 top-[72px] bg-background/95 backdrop-blur-xl z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            {/* Floating Menu Card - solid background */}
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ 
                type: "spring", 
                damping: 25, 
                stiffness: 300,
                mass: 0.8
              }}
              className="fixed inset-x-4 top-[84px] z-50 md:hidden bg-card rounded-2xl border border-border shadow-2xl shadow-black/20 dark:shadow-black/40 max-h-[calc(100vh-100px)] overflow-y-auto"
            >
              <div className="p-5">
                {/* Navigation Items */}
                <nav className="flex flex-col">
                  {navItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ 
                        type: "spring",
                        damping: 20,
                        stiffness: 300,
                        delay: index * 0.04 
                      }}
                    >
                      {'href' in item && item.href ? (
                        <Link
                          to={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center justify-between text-foreground hover:text-primary transition-all text-[15px] font-medium py-3.5 px-3 -mx-3 rounded-xl hover:bg-primary/5 active:bg-primary/10 active:scale-[0.98] touch-manipulation group border-l-2 border-transparent hover:border-primary"
                        >
                          <span>{item.label}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </Link>
                      ) : (
                        <button 
                          onClick={() => scrollToSection(item.id)}
                          className="flex items-center justify-between w-full text-foreground hover:text-primary transition-all text-[15px] font-medium py-3.5 px-3 -mx-3 rounded-xl hover:bg-primary/5 active:bg-primary/10 active:scale-[0.98] touch-manipulation group border-l-2 border-transparent hover:border-primary"
                        >
                          <span>{item.label}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </button>
                      )}
                      {/* Separator line - not after last item */}
                      {index < navItems.length - 1 && (
                        <div className="h-px bg-border/30 mx-0" />
                      )}
                    </motion.div>
                  ))}
                </nav>

                {/* Theme Toggle Row */}
                <motion.div 
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    type: "spring",
                    damping: 20,
                    stiffness: 300,
                    delay: navItems.length * 0.04 + 0.05 
                  }}
                  className="flex items-center justify-between px-3 py-2.5 mt-4 rounded-xl bg-muted border border-border/50"
                >
                  <span className="text-sm font-medium text-muted-foreground">Theme</span>
                  <ThemeToggle />
                </motion.div>

                {/* CTA Buttons */}
                <motion.div 
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    type: "spring",
                    damping: 20,
                    stiffness: 300,
                    delay: navItems.length * 0.04 + 0.1 
                  }}
                  className="flex flex-col gap-2.5 mt-4"
                >
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="h-12 text-[15px] rounded-xl border-primary/50 text-primary hover:bg-primary/10 active:scale-[0.98] transition-all"
                    onClick={() => scrollToSection('beta-program')}
                  >
                    <FlaskConical className="h-4 w-4 mr-2" />
                    Join Beta - 50% Off
                  </Button>
                  <Button 
                    asChild 
                    variant="outline" 
                    size="lg" 
                    className="h-12 text-[15px] rounded-xl border-border bg-background hover:bg-muted active:scale-[0.98] transition-all"
                  >
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                  </Button>
                  <Button 
                    asChild 
                    size="lg" 
                    className="h-12 text-[15px] rounded-xl shadow-lg shadow-primary/25 active:scale-[0.98] transition-all"
                  >
                    <Link to="/demo-sandbox" onClick={() => setMobileMenuOpen(false)}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Try Interactive Demo
                    </Link>
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
});