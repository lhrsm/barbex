import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, MessageCircle } from "lucide-react";

interface PortalStickyCtaProps {
  onBook: () => void;
  whatsapp?: string | null;
  shopName?: string;
  label?: string;
  hidden?: boolean;
}

/**
 * Mobile-only sticky conversion bar.
 * In R2E.21B.1, the duplicate floating bottom CTA on mobile was removed in favor
 * of the persistent, accessible sticky header CTA to avoid dual fixed CTAs.
 */
export function PortalStickyCta({ hidden = true }: PortalStickyCtaProps) {
  // Mobile sticky CTA disabled per R2E.21B.1 FASE 3 to avoid dual fixed CTAs
  return null;
}
