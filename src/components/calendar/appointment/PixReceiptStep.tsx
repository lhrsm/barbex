import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileUp, Loader2, Receipt, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "./appointment-utils";
import { cn } from "@/lib/utils";

const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

interface Props {
  tenantId: string;
  appointmentId: string;
  customerId?: string | null;
  customerName?: string | null;
  serviceName?: string | null;
  amount: number;
  dateLabel: string;
  timeLabel: string;
  shopName?: string | null;
  pixKey?: string | null;
  whatsappNumber?: string | null;
  onFinish: () => void;
}

function onlyDigits(v?: string | null) {
  return (v || "").replace(/\D+/g, "");
}

export function PixReceiptStep({
  tenantId,
  appointmentId,
  customerId,
  customerName,
  serviceName,
  amount,
  dateLabel,
  timeLabel,
  shopName,
  pixKey,
  whatsappNumber,
  onFinish,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  const digits = onlyDigits(whatsappNumber);
  const waNumber = digits ? (digits.length <= 11 ? `55${digits}` : digits) : "";
  const waMessage = encodeURIComponent(
    `Olá${shopName ? ` ${shopName}` : ""}! Segue o comprovante do PIX do meu agendamento.\n\n` +
      `👤 Cliente: ${customerName || "-"}\n` +
      `✂️ Serviço: ${serviceName || "-"}\n` +
      `📅 Data: ${dateLabel} às ${timeLabel}\n` +
      `💰 Valor: ${formatBRL(amount)}`,
  );
  const waLink = waNumber ? `https://wa.me/${waNumber}?text=${waMessage}` : null;

  function pickFile(f: File | null) {
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) {
      toast.error("Envie uma imagem (PNG, JPG, WEBP) ou PDF.");
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error("Arquivo muito grande. Limite de 8MB.");
      return;
    }
    setFile(f);
    setSaved(false);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  function clearFile() {
    setFile(null);
    setPreview(null);
    setSaved(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleUpload(markWhatsapp = false) {
    if (!file) {
      toast.error("Selecione o comprovante antes de salvar.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${tenantId}/${appointmentId}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("payment-receipts")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: auth } = await supabase.auth.getUser();

      const { error: insErr } = await supabase.from("payment_receipts").insert([
        {
          tenant_id: tenantId,
          appointment_id: appointmentId,
          customer_id: customerId || null,
          method: "pix",
          amount,
          file_path: path,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          notes: notes || null,
          status: "pending",
          sent_via_whatsapp: markWhatsapp,
          uploaded_by: auth.user?.id || null,
        },
      ]);
      if (insErr) throw insErr;

      setSaved(true);
      toast.success("Comprovante armazenado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao salvar comprovante: " + (error?.message || "tente novamente"));
    } finally {
      setUploading(false);
    }
  }

  async function handleWhatsapp() {
    if (file && !saved) await handleUpload(true);
    if (waLink) window.open(waLink, "_blank", "noopener,noreferrer");
    else toast.error("Nenhum WhatsApp cadastrado nas configurações da barbearia.");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold">
            <Receipt className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-zinc-900">Comprovante do PIX</h3>
            <p className="text-xs text-zinc-500">
              Valor {formatBRL(amount)} • {dateLabel} às {timeLabel}
            </p>
          </div>
        </div>

        {pixKey && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Chave PIX
              </p>
              <p className="truncate text-sm font-bold text-zinc-900">{pixKey}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg border-zinc-200 bg-white text-xs font-bold text-zinc-700 hover:bg-zinc-100"
              onClick={() => {
                navigator.clipboard?.writeText(pixKey);
                toast.success("Chave PIX copiada!");
              }}
            >
              Copiar
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs">
        <Label className="text-xs font-semibold text-zinc-600">Anexar comprovante</Label>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] || null)}
        />

        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-8 text-center transition-colors hover:border-gold/60 hover:bg-gold/5 cursor-pointer"
          >
            <FileUp className="h-6 w-6 text-gold" />
            <span className="text-sm font-bold text-zinc-900">Selecionar arquivo</span>
            <span className="text-xs text-zinc-400">PNG, JPG, WEBP ou PDF até 8MB</span>
          </button>
        ) : (
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
            {preview ? (
              <img
                src={preview}
                alt="Pré-visualização do comprovante"
                className="h-16 w-16 rounded-lg object-cover"
              />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-lg bg-gold/10 text-gold">
                <Receipt className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-zinc-900">{file.name}</p>
              <p className="text-xs text-zinc-500">
                {(file.size / 1024).toFixed(0)} KB {saved && "• armazenado"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-lg text-zinc-400 hover:text-destructive"
              onClick={clearFile}
              aria-label="Remover arquivo"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="mt-3 space-y-1.5">
          <Label htmlFor="receipt-notes" className="text-xs font-semibold text-zinc-600">
            Observação (opcional)
          </Label>
          <Textarea
            id="receipt-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
            placeholder="Ex.: pagamento feito pelo app do banco às 14h30"
            className="min-h-[70px] rounded-xl border-zinc-200/90 bg-white text-zinc-900"
          />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            onClick={() => handleUpload(false)}
            disabled={uploading || !file || saved}
            className="h-11 rounded-xl font-bold bg-black text-white hover:bg-zinc-800"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enviando...
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Comprovante salvo
              </>
            ) : (
              <>
                <FileUp className="mr-1.5 h-4 w-4" /> Salvar comprovante
              </>
            )}
          </Button>

          <Button
            type="button"
            onClick={handleWhatsapp}
            disabled={uploading}
            className={cn(
              "h-11 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700",
              !waLink && "opacity-60",
            )}
          >
            Enviar pelo WhatsApp
          </Button>
        </div>

        {!waLink && (
          <p className="mt-2 text-xs font-medium text-zinc-400">
            Cadastre o número de WhatsApp da barbearia em Configurações para habilitar o envio direto.
          </p>
        )}
      </section>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onFinish}
          className="h-11 rounded-xl font-semibold border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100"
        >
          <X className="mr-1.5 h-4 w-4" />
          Concluir
        </Button>
      </div>
    </div>
  );
}
