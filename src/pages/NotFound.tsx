import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#08090A] flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center pt-16">
        <div className="text-center space-y-4 px-4">
          <p className="text-[120px] font-bold leading-none text-zinc-800">404</p>
          <h1 className="text-2xl font-semibold text-white">Page not found</h1>
          <p className="text-zinc-500 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button
              onClick={() => navigate("/")}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-[10px] h-11 font-semibold cta-glow gap-2"
            >
              <Home className="h-4 w-4" />
              Go home
            </Button>
            <Link
              to="/contact"
              className="text-sm text-orange-500 hover:text-orange-400 transition-colors"
            >
              Contact support
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default NotFound;
