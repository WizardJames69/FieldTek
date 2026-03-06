import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface AuthLayoutProps {
  children: ReactNode;
  maxWidth?: string;
}

export function AuthLayout({ children, maxWidth = "max-w-[420px]" }: AuthLayoutProps) {
  return (
    <div className="auth-page flex items-center justify-center p-5 md:p-8 relative">
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>

      <div className="auth-glow">
        <div
          className={`${maxWidth} w-full bg-[#111214] border border-white/[0.06] rounded-2xl p-6 sm:p-8 md:p-10 relative z-10 animate-fade-up`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
