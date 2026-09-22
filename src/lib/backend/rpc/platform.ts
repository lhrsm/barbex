import { supabase } from "@/integrations/supabase/client";

export interface PlatformPublicSettings {
  saas_name: string;
  main_url: string;
  saas_logo: string | null;
  public_email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  address: string | null;
  social_links: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    linkedin?: string;
    youtube?: string;
    twitter?: string;
  } | null;
  has_contact_form: boolean;
}

const DEFAULT_SETTINGS: PlatformPublicSettings = {
  saas_name: "Barbex",
  main_url: "https://barbex.shop",
  saas_logo: null,
  public_email: null,
  phone: null,
  whatsapp_number: null,
  address: null,
  social_links: null,
  has_contact_form: false,
};

export async function getPublicPlatformSettingsClient(): Promise<PlatformPublicSettings> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_public_platform_settings");
    if (error) {
      console.warn(
        "[PlatformSettings] Error invoking get_public_platform_settings RPC, fallback to default:",
        error.message,
      );
      return DEFAULT_SETTINGS;
    }
    return (data as PlatformPublicSettings) || DEFAULT_SETTINGS;
  } catch (err) {
    console.warn("[PlatformSettings] Exception invoking get_public_platform_settings RPC:", err);
    return DEFAULT_SETTINGS;
  }
}
