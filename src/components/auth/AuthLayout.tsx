import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface AuthLayoutProps {
  children: ReactNode;
  maxWidth?: string;
}

export function AuthLayout({ children, maxWidth = "max-w-[420px]" }: AuthLayoutProps) {
  return (
    <div className="auth-page flex items-center justify-center p-5 md:p-8 relative overflow-hidden">
      {/* Background treatment matching the landing hero glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-5%,rgba(249,115,22,0.07),transparent_60%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
      </div>

      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>

      <div className="auth-glow">
        <div
          className={`${maxWidth} w-full bg-[#111214] border border-white/[0.08] rounded-2xl p-6 sm:p-8 md:p-10 relative z-10 animate-fade-up shadow-2xl shadow-black/50`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
