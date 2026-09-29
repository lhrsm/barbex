import { createFileRoute } from "@tanstack/react-router";
import { PlatformContactInbox } from "@/components/admin/PlatformContactInbox";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/messages")({
  component: AdminMessagesPage,
  head: () => ({
    title: "Mensagens da Plataforma | Barbex Super Admin",
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function AdminMessagesPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Mensagens da Plataforma
            </h1>
            <Badge variant="outline" className="border-primary/40 text-primary">
              R2E.13F Promoted
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Central operacional de comunicação e atendimento a contatos institucionais, dúvidas e
            suporte das barbearias.
          </p>
        </div>
      </div>

      {/* Canonical Platform Contact Inbox Experience */}
      <PlatformContactInbox />
    </div>
  );
}
