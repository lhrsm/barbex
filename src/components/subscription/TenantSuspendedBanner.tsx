import { Ban } from "lucide-react";

interface TenantSuspendedBannerProps {
  status?: string | null;
}

export function TenantSuspendedBanner({ status }: TenantSuspendedBannerProps) {
  if (status !== "blocked" && status !== "suspended") return null;

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-white shadow-xl backdrop-blur-md">
      <div className="flex items-start gap-3.5">
        <div className="rounded-xl bg-rose-500/20 p-2 text-rose-400 border border-rose-500/30 shrink-0 mt-0.5">
          <Ban className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-black uppercase tracking-tight text-rose-400">
            Estabelecimento Temporariamente Suspenso
          </p>
          <p className="text-xs text-rose-200/90 leading-relaxed font-medium">
            As operações ativas (agendamentos, atendimentos presenciais e alterações cadastrais) foram desativadas administrativamente.
            Seus dados e relatórios históricos continuam disponíveis para consulta em modo de leitura.
            Para mais informações ou regularização, entre em contato com o suporte da plataforma.
          </p>
        </div>
      </div>
    </div>
  );
}
