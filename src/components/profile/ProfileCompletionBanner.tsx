import { useState } from "react";
import { useProfileCompletion } from "@/hooks/use-profile-completion";
import { EditProfileModal } from "./EditProfileModal";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, UserCheck, X } from "lucide-react";

interface ProfileCompletionBannerProps {
  className?: string;
}

export function ProfileCompletionBanner({ className = "" }: ProfileCompletionBannerProps) {
  const completion = useProfileCompletion();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Se o perfil já estiver 100% completo ou foi dispensado na sessão, não exibe
  if (completion.isComplete || isDismissed) {
    return null;
  }

  const missingText = completion.missingFields.join(" e ");

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-xl border border-gold/30 bg-gradient-to-r from-gold/15 via-[#1a1408] to-[#0b0f17] p-4 text-white shadow-lg backdrop-blur ${className}`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-gold shadow-sm">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">Complete seu perfil</p>
                <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-gold">
                  {completion.percentage}% completo
                </span>
              </div>
              <p className="text-xs text-zinc-300">
                Seu acesso está ativo. Faltam: <strong className="text-gold font-medium">{missingText}</strong> para personalizar sua experiência.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="bg-gold hover:bg-gold/90 text-black font-semibold text-xs shadow-md shadow-gold/10"
            >
              <span>Completar perfil</span>
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsDismissed(true)}
              aria-label="Dispensar aviso temporariamente"
              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <EditProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Complete seu perfil"
        description="Preencha suas informações para que sua equipe e clientes o identifiquem com facilidade."
      />
    </>
  );
}
