import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  X,
  Crown,
  Briefcase,
  Bell,
  Scissors,
  DollarSign,
  User,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  BookOpen,
  Calendar,
  CalendarDays,
  ListChecks,
  Users,
  Wallet,
  CircleDollarSign,
  TrendingUp,
  Building2,
  CreditCard,
  GraduationCap,
  Gift,
  HelpCircle,
  Lightbulb,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useModules } from "@/hooks/use-modules";
import {
  getRoleWelcomeConfig,
  getTutorialsForRole,
  type TutorialItem,
  type QuickActionItem,
} from "@/lib/tutorials.catalog";

export const CURRENT_ONBOARDING_VERSION = "2.0";

/**
 * Função utilitária global para reabrir o Onboarding a qualquer momento
 * a partir de botões de ajuda, menu do usuário ou Central de Ajuda.
 */
export function openOnboardingModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("barbex:open-onboarding"));
  }
}

function getActionIcon(iconName: string) {
  switch (iconName) {
    case "Calendar":
      return <Calendar className="w-4 h-4 text-gold shrink-0" />;
    case "CalendarDays":
      return <CalendarDays className="w-4 h-4 text-gold shrink-0" />;
    case "Scissors":
      return <Scissors className="w-4 h-4 text-gold shrink-0" />;
    case "Users":
      return <Users className="w-4 h-4 text-gold shrink-0" />;
    case "DollarSign":
      return <DollarSign className="w-4 h-4 text-gold shrink-0" />;
    case "ListChecks":
      return <ListChecks className="w-4 h-4 text-gold shrink-0" />;
    case "CircleDollarSign":
      return <CircleDollarSign className="w-4 h-4 text-gold shrink-0" />;
    case "TrendingUp":
      return <TrendingUp className="w-4 h-4 text-gold shrink-0" />;
    case "Building2":
      return <Building2 className="w-4 h-4 text-gold shrink-0" />;
    case "CreditCard":
      return <CreditCard className="w-4 h-4 text-gold shrink-0" />;
    case "GraduationCap":
      return <GraduationCap className="w-4 h-4 text-gold shrink-0" />;
    case "Gift":
      return <Gift className="w-4 h-4 text-gold shrink-0" />;
    default:
      return <Sparkles className="w-4 h-4 text-gold shrink-0" />;
  }
}

function getRoleBadgeIcon(iconName: string) {
  switch (iconName) {
    case "Crown":
      return <Crown className="w-3.5 h-3.5 text-gold" />;
    case "Briefcase":
      return <Briefcase className="w-3.5 h-3.5 text-blue-400" />;
    case "Bell":
      return <Bell className="w-3.5 h-3.5 text-amber-400" />;
    case "Scissors":
      return <Scissors className="w-3.5 h-3.5 text-purple-400" />;
    case "Wallet":
      return <Wallet className="w-3.5 h-3.5 text-emerald-400" />;
    case "DollarSign":
      return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
    case "User":
      return <User className="w-3.5 h-3.5 text-sky-400" />;
    case "ShieldCheck":
      return <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />;
    default:
      return <Sparkles className="w-3.5 h-3.5 text-gold" />;
  }
}

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [expandedTutorialId, setExpandedTutorialId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { user, role, identity, profile, loading: authLoading } = useAuth();
  const { hasPermission } = usePermissions();
  const { isEnabled } = useModules();

  // Escuta requisição de reabertura manual da modal
  useEffect(() => {
    const handleReopen = () => {
      setIsOpen(true);
    };
    window.addEventListener("barbex:open-onboarding", handleReopen);
    return () => {
      window.removeEventListener("barbex:open-onboarding", handleReopen);
    };
  }, []);

  // Busca preferências de exibição do usuário no Supabase
  const { data: preferences, isLoading: prefsLoading } = useQuery({
    queryKey: ["user-onboarding-prefs", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_onboarding_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return null;
      return data;
    },
    enabled: !!user,
  });

  // Controle de primeira exibição por perfil e sessão
  useEffect(() => {
    if (prefsLoading || authLoading || !user) return;

    const isEligible = role && role !== "unknown";
    if (!isEligible) return;

    const sessionKey = `onboarding_shown_${user.id}_${role}`;
    const hasBeenShownThisSession = sessionStorage.getItem(sessionKey);
    const isPreferenceActive = preferences?.show_onboarding !== false;

    if (!hasBeenShownThisSession && isPreferenceActive) {
      setIsOpen(true);
      sessionStorage.setItem(sessionKey, "true");
    }
  }, [prefsLoading, authLoading, preferences, user?.id, role]);

  const updatePrefsMutation = useMutation({
    mutationFn: async (show: boolean) => {
      if (!user) return;
      const { error } = await supabase.from("user_onboarding_preferences").upsert({
        user_id: user.id,
        show_onboarding: show,
        last_seen_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-onboarding-prefs", user?.id] });
    },
  });

  const handleClose = () => {
    if (dontShowAgain && user) {
      updatePrefsMutation.mutate(false);
    }
    setIsOpen(false);
  };

  const welcomeConfig = useMemo(() => {
    return getRoleWelcomeConfig(role);
  }, [role]);

  const authorizedTutorials = useMemo(() => {
    return getTutorialsForRole({
      role,
      hasPermission,
      isModuleEnabled: (key: string) => isEnabled(key),
    });
  }, [role, hasPermission, isEnabled]);

  const authorizedQuickActions = useMemo(() => {
    return welcomeConfig.quickActions.filter((action) => {
      if (action.requiredPermission && action.requiredPermission !== "*") {
        if (!hasPermission(action.requiredPermission)) return false;
      }
      if (action.moduleKey && !isEnabled(action.moduleKey)) {
        return false;
      }
      return true;
    });
  }, [welcomeConfig, hasPermission, isEnabled]);

  const userDisplayName =
    identity?.displayName ||
    profile?.responsible_name ||
    profile?.display_name ||
    profile?.full_name ||
    "Colaborador";

  const businessName =
    identity?.businessName ||
    profile?.business_name ||
    "sua barbearia";

  const isClient = role === "client" || role === "customer";
  const helpCenterRoute = isClient
    ? identity?.tenantSlug
      ? `/${identity.tenantSlug}/portal`
      : "/portal"
    : "/tutorials";

  const toggleTutorial = (id: string) => {
    setExpandedTutorialId((prev) => (prev === id ? null : id));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="max-w-4xl w-[95vw] md:w-full p-0 bg-[#070b14] border border-gold/20 text-white overflow-hidden shadow-[0_0_80px_rgba(212,175,55,0.15)] rounded-3xl max-h-[90vh] md:max-h-[85vh] flex flex-col focus:outline-none"
        aria-describedby="onboarding-dialog-description"
      >
        {/* Cabeçalho Fixo */}
        <div className="p-5 md:p-7 border-b border-white/10 bg-[#0b1020]/90 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Badge className="bg-gold/15 border border-gold/30 text-gold font-black uppercase tracking-wider text-[10px] px-2.5 py-0.5 flex items-center gap-1.5 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                {getRoleBadgeIcon(welcomeConfig.iconName)}
                {welcomeConfig.badge}
              </Badge>
              <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest hidden sm:inline">
                Guia de Início
              </span>
            </div>
            <DialogTitle className="text-xl md:text-2xl font-black tracking-tight text-white uppercase italic leading-none pt-1">
              Olá, <span className="text-gold">{userDisplayName}</span>!
            </DialogTitle>
            <DialogDescription id="onboarding-dialog-description" className="text-xs md:text-sm text-white/60">
              Conectado a <span className="text-white font-semibold">{businessName}</span>. Veja as principais orientações da sua função:
            </DialogDescription>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-white/40 hover:text-white hover:bg-white/10 rounded-full h-9 w-9 shrink-0 focus-visible:ring-1 focus-visible:ring-gold"
            aria-label="Fechar guia de início"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Corpo Rolável */}
        <div className="overflow-y-auto flex-1 p-5 md:p-8 space-y-6 focus:outline-none">
          {/* Seção 1: Atalhos Rápidos */}
          {authorizedQuickActions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-gold flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Ações Rápidas Autorizadas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {authorizedQuickActions.map((action, idx) => (
                  <Link
                    key={idx}
                    to={action.route as any}
                    onClick={handleClose}
                    className="group p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-gold/30 transition-all duration-300 flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-xl bg-gold/10 border border-gold/20 group-hover:scale-110 transition-transform">
                        {getActionIcon(action.iconName)}
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-gold group-hover:translate-x-1 transition-all" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-gold transition-colors">
                        {action.label}
                      </h4>
                      <p className="text-xs text-white/50 leading-relaxed line-clamp-2 mt-0.5">
                        {action.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Seção 2: Tutoriais Passo a Passo Recomendados */}
          {authorizedTutorials.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-gold flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5" /> Tutoriais e Primeiros Passos
                </h3>
                <span className="text-[11px] font-semibold text-white/40">
                  {authorizedTutorials.length} guias disponíveis
                </span>
              </div>

              <div className="space-y-2.5">
                {authorizedTutorials.map((tut) => {
                  const isExpanded = expandedTutorialId === tut.id;
                  return (
                    <div
                      key={tut.id}
                      className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden transition-all duration-200 hover:border-white/10"
                    >
                      <button
                        type="button"
                        onClick={() => toggleTutorial(tut.id)}
                        className="w-full p-4 text-left flex items-start justify-between gap-4 focus:outline-none focus-visible:bg-white/5"
                        aria-expanded={isExpanded}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {tut.badge && (
                              <Badge variant="outline" className="text-[9px] uppercase tracking-wider border-white/10 text-white/60 px-1.5 py-0">
                                {tut.badge}
                              </Badge>
                            )}
                            <h4 className="text-sm font-bold text-white hover:text-gold transition-colors">
                              {tut.title}
                            </h4>
                          </div>
                          <p className="text-xs text-white/50 leading-relaxed">
                            {tut.description}
                          </p>
                        </div>
                        <div className="shrink-0 pt-0.5">
                          <ChevronDown
                            className={`w-4 h-4 text-white/40 transition-transform duration-300 ${
                              isExpanded ? "rotate-180 text-gold" : ""
                            }`}
                          />
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-white/5 bg-white/[0.01] px-5 py-4 space-y-3"
                          >
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-white/40">
                              Passo a Passo de Utilização:
                            </h5>
                            <ol className="space-y-2 text-xs text-white/80 list-decimal list-inside pl-1">
                              {tut.steps.map((st, i) => (
                                <li key={i} className="leading-relaxed">
                                  <span className="text-white/70">{st}</span>
                                </li>
                              ))}
                            </ol>

                            {tut.notes && (
                              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 leading-relaxed">
                                {tut.notes}
                              </div>
                            )}

                            <div className="pt-2 flex justify-end">
                              <Link
                                to={tut.route as any}
                                onClick={handleClose}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-gold hover:text-gold/80 transition-colors uppercase tracking-wider"
                              >
                                Acessar funcionalidade <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seção 3: Dica Operacional Barbex */}
          {welcomeConfig.operationalTip && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-gold/10 via-gold/5 to-transparent border border-gold/20 flex gap-3.5 items-start">
              <Lightbulb className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gold">
                  Dica de Operação Barbex
                </h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  {welcomeConfig.operationalTip}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé Fixo */}
        <div className="border-t border-white/10 p-4 md:px-8 md:py-4 bg-[#0a0f1d]/95 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center space-x-2.5">
            <Checkbox
              id="dontShowAgainOnboarding"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(Boolean(checked))}
              className="border-white/30 data-[state=checked]:bg-gold data-[state=checked]:text-black"
            />
            <label
              htmlFor="dontShowAgainOnboarding"
              className="text-xs font-medium text-white/60 cursor-pointer select-none hover:text-white transition-colors"
            >
              Não exibir este guia automaticamente ao iniciar
            </label>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="flex-1 sm:flex-none border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold h-10 px-4 rounded-xl text-xs uppercase tracking-wider"
            >
              <Link to={helpCenterRoute as any} onClick={handleClose}>
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                Central de Ajuda
              </Link>
            </Button>

            <Button
              size="sm"
              onClick={handleClose}
              className="flex-1 sm:flex-none bg-gold hover:bg-gold/90 text-black font-black h-10 px-6 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-gold/20"
            >
              Entendido
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
