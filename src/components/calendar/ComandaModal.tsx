import * as React from "react";
import { useEffect, useState } from "react";
import { Plus, Minus, Trash2, Package, ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface ComandaModalProps {
  appointmentId: string;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  image_url?: string | null;
}

interface ComandaSale {
  id: string;
  total_amount: number;
  created_at: string;
  items: Array<{ id: string; name: string; quantity: number; price: number }>;
}

export function ComandaModal({ appointmentId, tenantId, open, onOpenChange, onChanged }: ComandaModalProps) {
  const queryClient = useQueryClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<ComandaSale[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [prodRes, saleRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, price, stock_quantity, image_url")
          .eq("user_id", tenantId)
          .order("name"),
        supabase
          .from("product_sales")
          .select("id, total_amount, created_at, items")
          .eq("appointment_id", appointmentId)
          .order("created_at", { ascending: true }),
      ]);
      if (prodRes.data) setProducts(prodRes.data as any);
      if (saleRes.data) setSales(saleRes.data as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSearch("");
      setQuantities({});
      load();
    }
  }, [open, appointmentId]);

  const bumpQty = (id: string, delta: number) => {
    setQuantities(q => ({ ...q, [id]: Math.max(1, (q[id] || 1) + delta) }));
  };

  const addProduct = async (product: Product) => {
    const qty = quantities[product.id] || 1;
    if (product.stock_quantity < qty) {
      toast.error(`Estoque insuficiente (disponível: ${product.stock_quantity})`);
      return;
    }
    setBusyId(product.id);
    try {
      const { data, error } = await supabase.rpc("add_product_to_comanda", {
        p_appointment_id: appointmentId,
        p_product_id: product.id,
        p_quantity: qty,
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error("Falha ao adicionar");
      toast.success(`${product.name} adicionado à comanda`);
      await load();
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onChanged?.();
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("insufficient_stock")) toast.error("Estoque insuficiente");
      else if (msg.includes("forbidden")) toast.error("Você não tem permissão para esta comanda");
      else toast.error("Erro ao adicionar produto: " + msg);
    } finally {
      setBusyId(null);
    }
  };

  const removeSale = async (saleId: string) => {
    setBusyId(saleId);
    try {
      const { data, error } = await supabase.rpc("remove_comanda_item", { p_sale_id: saleId });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error("Falha ao remover");
      toast.success("Item removido da comanda");
      await load();
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      onChanged?.();
    } catch (err: any) {
      toast.error("Erro ao remover: " + (err?.message || ""));
    } finally {
      setBusyId(null);
    }
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const comandaTotal = sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "bg-[#0b0f17] border-gold/20 text-white p-0 gap-0",
          "w-[calc(100%-1.5rem)] sm:w-full",
          "max-w-md sm:max-w-2xl md:max-w-3xl lg:max-w-4xl",
          "max-h-[85vh] sm:max-h-[88vh]",
          "rounded-2xl sm:rounded-3xl",
          "flex flex-col overflow-hidden shadow-2xl"
        )}
      >
        <DialogHeader className="flex-shrink-0 p-4 sm:p-5 pb-3 sm:pb-4 border-b border-gold/10 bg-[#0b0f17]/95">
          <DialogTitle className="text-base sm:text-lg font-black uppercase italic text-gold flex items-center gap-2 sm:gap-2.5">
            <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-gold shrink-0" />
            <span>Comanda Digital</span>
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-[11px] sm:text-xs">
            Adicione produtos consumidos durante o atendimento. O valor entra automaticamente na conta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
          {/* Coluna 1: Produtos disponíveis */}
          <div className="flex flex-col min-h-0 p-4 sm:p-5 md:overflow-y-auto">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                Produtos disponíveis
              </p>
              <Badge variant="outline" className="text-[9px] border-white/10 text-gray-400">
                {products.length} cadastrados
              </Badge>
            </div>

            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3 h-9 bg-black/40 border-white/10 text-white text-xs sm:text-sm placeholder:text-gray-500 focus-visible:ring-gold/30 rounded-lg"
            />

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-xs gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-gold" />
                <span>Carregando catálogo...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-xs">
                <Package className="mx-auto mb-2 h-6 w-6 opacity-40 text-gray-400" />
                {products.length === 0 ? "Nenhum produto cadastrado" : "Nenhum produto encontrado"}
              </div>
            ) : (
              <div className="space-y-2 pr-0 sm:pr-1">
                {filtered.map(p => {
                  const qty = quantities[p.id] || 1;
                  const noStock = p.stock_quantity <= 0;
                  return (
                    <div
                      key={p.id}
                      className="p-2.5 sm:p-3 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-gold/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-white truncate" title={p.name}>
                            {p.name}
                          </p>
                          <p className="text-xs text-gold font-black">
                            R$ {Number(p.price).toFixed(2)}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] shrink-0 font-medium",
                            noStock
                              ? "text-red-400 border-red-500/30 bg-red-500/10"
                              : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                          )}
                        >
                          {noStock ? "Esgotado" : `${p.stock_quantity} em estoque`}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-black/50 rounded-lg border border-white/10 shrink-0">
                          <button
                            type="button"
                            className="h-8 w-7 inline-flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-20 transition-colors"
                            onClick={() => bumpQty(p.id, -1)}
                            disabled={qty <= 1}
                            aria-label="Diminuir quantidade"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-white select-none">
                            {qty}
                          </span>
                          <button
                            type="button"
                            className="h-8 w-7 inline-flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-20 transition-colors"
                            onClick={() => bumpQty(p.id, 1)}
                            disabled={qty >= p.stock_quantity}
                            aria-label="Aumentar quantidade"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <Button
                          size="sm"
                          className="flex-1 h-8 bg-gold hover:bg-[#B8962E] text-black font-black uppercase text-[10px] tracking-wider rounded-lg transition-all disabled:opacity-40"
                          onClick={() => addProduct(p)}
                          disabled={busyId === p.id || noStock}
                        >
                          {busyId === p.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Adicionar"
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coluna 2: Comanda atual */}
          <div className="flex flex-col min-h-0 p-4 sm:p-5 bg-black/20 md:overflow-y-auto">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                Comanda atual
              </p>
              <Badge variant="outline" className="text-[9px] border-gold/30 text-gold">
                {sales.length} {sales.length === 1 ? "item" : "itens"}
              </Badge>
            </div>

            {sales.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-xs flex-1 flex flex-col items-center justify-center">
                <ShoppingBag className="mx-auto mb-2 h-6 w-6 opacity-30 text-gray-400" />
                <span>Nenhum produto adicionado nesta comanda.</span>
              </div>
            ) : (
              <div className="space-y-2 pr-0 sm:pr-1 flex-1">
                {sales.map(s => (
                  <div
                    key={s.id}
                    className="p-2.5 sm:p-3 rounded-xl bg-zinc-900/60 border border-white/5"
                  >
                    {(s.items || []).map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs gap-2">
                        <span className="text-gray-300 font-medium truncate">
                          {it.quantity}x {it.name}
                        </span>
                        <span className="text-white font-bold shrink-0">
                          R$ {Number(it.price * it.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold">Subtotal</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gold font-black text-xs sm:text-sm">
                          R$ {Number(s.total_amount).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          className="p-1 rounded text-red-400/70 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-colors"
                          onClick={() => removeSale(s.id)}
                          disabled={busyId === s.id}
                          title="Remover"
                          aria-label="Remover item da comanda"
                        >
                          {busyId === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Card de Totalização */}
            <div className="mt-4 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-gold/15 to-transparent border border-gold/30 shadow-inner shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">
                  Total da Comanda
                </span>
                <span className="text-xl sm:text-2xl font-black text-white">
                  R$ {comandaTotal.toFixed(2)}
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-gray-400 mt-1.5">
                Valor lançado automaticamente na conta do atendimento.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 p-3 sm:p-4 border-t border-gold/10 bg-[#05070d]/80 backdrop-blur-sm flex-row items-center justify-between sm:justify-end gap-3">
          <div className="flex flex-col sm:hidden">
            <span className="text-[9px] uppercase font-bold text-gray-400">Total</span>
            <span className="text-sm font-black text-gold">R$ {comandaTotal.toFixed(2)}</span>
          </div>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl bg-gold hover:bg-[#B8962E] text-black font-black uppercase text-[10px] sm:text-xs tracking-wider px-5 sm:px-8 h-9 sm:h-10 transition-all shadow-md active:scale-95"
          >
            Fechar Comanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
