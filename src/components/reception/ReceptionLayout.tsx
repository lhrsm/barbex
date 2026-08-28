import { useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  ListChecks,
  Menu,
  X,
  LogOut,
  Scissors,
  User,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useReception } from "@/hooks/use-reception";
import { useTenant } from "@/hooks/use-tenant";
import { EditProfileModal } from "@/components/profile/EditProfileModal";

const NAV = [
  { label: "Início", to: "/reception", icon: LayoutDashboard, exact: true },
  { label: "Agenda", to: "/reception/agenda", icon: CalendarDays },
  { label: "Lista de espera", to: "/reception/waiting-list", icon: ListChecks },
  { label: "Clientes", to: "/reception/customers", icon: Users },
];

export function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { isOwner, profile, user } = useReception();
  const { tenantProfile } = useTenant();

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const userName = profile?.responsible_name || profile?.display_name || profile?.email || user?.email || "Recepcionista";
  const barbershopName = tenantProfile?.business_name || profile?.business_name || "Barbex";
  const userInitial = (userName?.[0] || "R").toUpperCase();

  const nav = (
    <nav className="flex flex-col gap-1.5" aria-label="Navegação da recepção">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
            isActive(item.to, item.exact)
              ? "bg-gold/15 text-gold border border-gold/30 font-semibold shadow-sm"
              : "text-zinc-400 hover:bg-white/[0.04] hover:text-white",
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" aria-hidden />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#07090e] text-white">
      {/* Topbar mobile */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-800/80 bg-[#0b0f17]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 border border-gold/30 text-gold font-bold">
            <Scissors className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <span className="text-sm font-bold text-white block leading-tight">Central de Atendimento</span>
            <span className="text-[11px] text-zinc-400 truncate block max-w-[180px]">{barbershopName}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Meu Perfil"
            onClick={() => setIsProfileOpen(true)}
            className="h-9 w-9 text-zinc-400 hover:text-white"
          >
            <User className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((v) => !v)}
            className="h-9 w-9 text-zinc-400 hover:text-white"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {open && (
        <div className="border-b border-zinc-800 bg-[#0b0f17] px-4 py-4 lg:hidden space-y-4 shadow-xl">
          {nav}
          <div className="pt-3 border-t border-zinc-800 space-y-2">
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="h-8 w-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold text-xs">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{userName}</p>
                <p className="text-[10px] text-zinc-400 truncate">{barbershopName}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs justify-start border-zinc-800 text-zinc-300"
              onClick={() => {
                setOpen(false);
                setIsProfileOpen(true);
              }}
            >
              <User className="mr-2 h-3.5 w-3.5 text-gold" /> Meu Perfil
            </Button>
            {isOwner && (
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="block text-center rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:text-white"
              >
                Voltar ao painel administrativo
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 justify-start"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" /> Sair da conta
            </Button>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-800/80 bg-[#0b0f17] p-4 lg:flex shadow-2xl">
          {/* Logo / Header da Sidebar */}
          <div className="mb-6 flex items-center gap-3 px-2 py-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 text-gold shadow-md">
              <Scissors className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-black text-white leading-tight">Recepção</p>
                <Badge variant="outline" className="border-gold/30 text-gold text-[9px] px-1 py-0 uppercase font-bold">
                  Operação
                </Badge>
              </div>
              <p className="text-xs text-zinc-400 truncate mt-0.5" title={barbershopName}>
                {barbershopName}
              </p>
            </div>
          </div>

          {/* Menus */}
          {nav}

          {/* Rodapé da Sidebar com Identidade & Ações */}
          <div className="mt-auto pt-4 border-t border-zinc-800/80 space-y-2">
            <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-2.5">
              <div className="h-8 w-8 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center text-gold font-bold text-xs shrink-0">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate leading-tight">{userName}</p>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Recepção Ativa
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs justify-start border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800/60"
              onClick={() => setIsProfileOpen(true)}
            >
              <User className="mr-2 h-3.5 w-3.5 text-gold" /> Meu Perfil
            </Button>

            {isOwner && (
              <Link
                to="/dashboard"
                className="block text-center rounded-lg border border-zinc-800/60 px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/40 transition-colors"
              >
                Voltar ao painel administrativo
              </Link>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10 justify-start"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" aria-hidden /> Sair
            </Button>
          </div>
        </aside>

        {/* Conteúdo Principal */}
        <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      <EditProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
}
