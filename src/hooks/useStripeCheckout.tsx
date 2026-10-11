import { useState, useCallback, useEffect } from "react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";

export interface CheckoutOptions {
  planKey: "starter" | "pro" | "elite";
  billingCycle: "month" | "year";
  customerEmail?: string;
  userId?: string;
  returnUrl?: string;
  tenantId?: string;
  tenantName?: string;
  planName?: string;
  price?: string;
  features?: string[];
}

export function useStripeCheckout() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const { user } = useAuth();
  const { tenantId } = useTenant();

  const openCheckout = useCallback((opts: CheckoutOptions) => {
    console.log("[useStripeCheckout] 🛍️ Abrindo checkout com opções:", opts);
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const closeCheckout = useCallback(() => {
    setIsOpen(false);
    setOptions(null);
  }, []);

  // Stale checkout protection: unmount if user logs out or active tenant changes
  useEffect(() => {
    if (isOpen && options) {
      if (!user) {
        console.warn("[useStripeCheckout] 🛑 Sessão encerrada (logout); desmontando checkout.");
        closeCheckout();
      } else if (options.tenantId && tenantId && options.tenantId !== tenantId) {
        console.warn(
          "[useStripeCheckout] 🛑 Mudança de tenant detectada; invalidando checkout obsoleto.",
        );
        closeCheckout();
      } else if (options.userId && user.id && options.userId !== user.id) {
        console.warn(
          "[useStripeCheckout] 🛑 Mudança de usuário detectada; invalidando checkout obsoleto.",
        );
        closeCheckout();
      }
    }
  }, [isOpen, options, user, tenantId, closeCheckout]);

  const checkoutElement = isOpen && options ? <StripeEmbeddedCheckout {...options} /> : null;

  return { openCheckout, closeCheckout, isOpen, options, checkoutElement };
}
