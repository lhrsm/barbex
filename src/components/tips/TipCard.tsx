import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Copy, Heart, CheckCircle2, Info, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TipCardProps {
  token: string;
  barberName?: string | null;
  barberAvatar?: string | null;
  pixKey?: string | null;
  pixKeyType?: string | null;
  pixQrCodeUrl?: string | null;
  serviceAmount?: number;
}

const PRESETS = [5, 10, 20];

const PIX_TYPE_LABELS: Record<string, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  phone: "Celular",
  email: "E-mail",
  random: "Chave Aleatória",
};

export function TipCard({
  token,
  barberName,
  barberAvatar,
  pixKey,
  pixKeyType,
  pixQrCodeUrl,
  serviceAmount,
}: TipCardProps) {
  const [amount, setAmount] = useState<number>(0);
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!pixKey) return null;

  const setPreset = (v: number) => setAmount(v);
  const setPct = (p: number) => {
    if (!serviceAmount) return;
    setAmount(Math.round(serviceAmount * (p / 100) * 100) / 100);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pixKey);
      setCopied(true);
      toast.success("Chave PIX copiada!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Não foi possível copiar a chave");
    }
  };

  const register = async () => {
    if (amount <= 0) {
      toast.error("Escolha um valor para a gorjeta");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("register_pix_tip", {
        _token: token,
        _amount: amount,
        _note: undefined,
      });
      if (error) throw error;
      const res = data as any;
      if (!res?.success) {
        toast.error(res?.error || "Não foi possível registrar a intenção de gorjeta");
        return;
      }
      setSent(true);
      toast.success("Obrigado pela gorjeta! 🎉");
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar");
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = pixKeyType ? PIX_TYPE_LABELS[pixKeyType] || pixKeyType.toUpperCase() : null;

  return (
    <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-[#0b0f17] to-black p-5 space-y-5">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border border-gold/40">
          <AvatarImage src={barberAvatar || undefined} />
          <AvatarFallback className="bg-gold/20 text-gold font-black">
            {(barberName || "B").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gold font-bold">Gorjeta digital</p>
          <p className="text-white font-black">Agradecer {barberName || "o profissional"}</p>
        </div>
      </div>

      {sent ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
          <p className="text-white font-bold">Gorjeta registrada com sucesso!</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Transfira R$ {amount.toFixed(2)} via PIX utilizando a chave copiada abaixo diretamente para{" "}
            <span className="text-white font-bold">{barberName || "o profissional"}</span>.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((v) => (
              <button
                key={v}
                onClick={() => setPreset(v)}
                className={`rounded-xl border py-2.5 text-sm font-bold transition cursor-pointer ${
                  amount === v
                    ? "bg-gold text-black border-gold"
                    : "border-white/10 text-gray-300 hover:border-gold/50"
                }`}
              >
                R$ {v}
              </button>
            ))}
          </div>
          {serviceAmount ? (
            <div className="grid grid-cols-3 gap-2">
              {[10, 15, 20].map((p) => (
                <button
                  key={p}
                  onClick={() => setPct(p)}
                  className="rounded-xl border border-white/10 text-gray-300 py-2 text-xs font-bold hover:border-gold/50 transition cursor-pointer"
                >
                  {p}% do serviço
                </button>
              ))}
            </div>
          ) : null}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-white/60">Outro valor</label>
            <Input
              type="number"
              step="0.5"
              min={0}
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="R$ 0,00"
              className="bg-black border-gold/30 text-white mt-1 h-11 rounded-xl"
            />
          </div>
        </>
      )}

      {/* Caixa da Chave PIX e Beneficiário */}
      <div className="rounded-xl border border-gold/20 bg-black/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gold font-bold">
            Chave PIX do Profissional
          </div>
          {typeLabel && (
            <Badge variant="outline" className="text-[9px] uppercase border-gold/30 text-gold bg-gold/5 font-bold">
              {typeLabel}
            </Badge>
          )}
        </div>

        <div className="text-xs text-zinc-400">
          Beneficiário: <strong className="text-white">{barberName || "Profissional"}</strong>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 truncate text-xs sm:text-sm text-white font-mono bg-black/80 border border-white/10 rounded-xl px-3.5 py-2.5 select-all">
            {pixKey}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copy}
            className={`rounded-xl border transition-all h-10 px-4 gap-1.5 font-bold text-xs shrink-0 cursor-pointer ${
              copied
                ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 hover:bg-emerald-500/30"
                : "border-gold/50 text-gold hover:bg-gold/10"
            }`}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Chave copiada!" : "Copiar chave PIX"}
          </Button>
        </div>

        {/* QR Code opcional apenas se houver imagem legítima cadastrada */}
        {pixQrCodeUrl && (
          <div className="flex flex-col items-center justify-center pt-2">
            <img
              src={pixQrCodeUrl}
              alt="QR Code PIX do profissional"
              width={160}
              height={160}
              className="rounded-xl border border-gold/30 bg-black/40 p-1.5 object-contain"
            />
            <span className="text-[10px] text-zinc-400 mt-1.5">QR Code oficial do profissional</span>
          </div>
        )}

        {/* Informação explícita de pagamento direto */}
        <div className="rounded-xl border border-gold/15 bg-gold/5 p-3 text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2.5">
          <Info className="h-4 w-4 shrink-0 text-gold mt-0.5" />
          <span>
            <strong>Pagamento direto:</strong> A transferência da gorjeta é realizada diretamente do seu banco para o profissional via PIX. O valor é creditado integralmente ao barbeiro e não passa pela barbearia.
          </span>
        </div>
      </div>

      {!sent && (
        <Button
          onClick={register}
          disabled={saving || amount <= 0}
          className="w-full h-12 bg-gold hover:bg-[#B8962E] text-black font-black text-sm rounded-xl cursor-pointer disabled:opacity-50 transition-all shadow-md"
        >
          <Heart className="h-4 w-4 mr-2" />
          {saving ? "Registrando..." : `Confirmar gorjeta de R$ ${amount.toFixed(2)}`}
        </Button>
      )}
    </div>
  );
}
