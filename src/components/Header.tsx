import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
import logo from "@/assets/health.png";

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img src={logo} alt="Logo" className="h-10 w-10 transition-transform group-hover:scale-110" />
            <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              HealthTech
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Início
            </Link>
            <Link to="/kiosk" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Totem
            </Link>
            <Link to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </nav>
          
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">Sistema Ativo</span>
          </div>
        </div>
      </div>
    </header>
  );
};
