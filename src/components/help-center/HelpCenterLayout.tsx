import { ReactNode } from "react";
import { AppLayout } from "@/components/layout/AppLayout";

interface HelpCenterLayoutProps {
  children: ReactNode;
}

export function HelpCenterLayout({ children }: HelpCenterLayoutProps) {
  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] text-white">
        <div className="p-3 sm:p-5 md:p-6 lg:p-8 max-w-[1400px] mx-auto animate-in fade-in duration-300">
          {children}
        </div>
      </div>
    </AppLayout>
  );
}
