import { useAuth } from "@/hooks/use-auth";

export interface ProfileCompletionStatus {
  isComplete: boolean;
  percentage: number;
  missingFields: string[];
  hasName: boolean;
  hasPhone: boolean;
  hasAvatar: boolean;
  name: string;
  phone: string;
  email: string;
  avatarUrl: string;
}

export function useProfileCompletion(): ProfileCompletionStatus {
  const { profile, user } = useAuth();

  const name = (profile?.display_name || profile?.responsible_name || profile?.full_name || "").trim();
  const phone = (profile?.phone || "").trim();
  const email = (profile?.email || user?.email || "").trim();
  const avatarUrl = ((profile as any)?.avatar_url || (profile as any)?.logo_url || "").trim();

  const hasName = Boolean(name && name.length >= 2);
  const hasPhone = Boolean(phone && phone.length >= 8);
  const hasAvatar = Boolean(avatarUrl);

  const missingFields: string[] = [];
  if (!hasName) missingFields.push("Nome completo");
  if (!hasPhone) missingFields.push("WhatsApp");

  let percentage = 0;
  if (hasName && hasPhone) {
    percentage = 100;
  } else if (hasName || hasPhone) {
    percentage = 50;
  } else {
    percentage = 0;
  }

  const isComplete = percentage === 100;

  return {
    isComplete,
    percentage,
    missingFields,
    hasName,
    hasPhone,
    hasAvatar,
    name,
    phone,
    email,
    avatarUrl,
  };
}
