import { supabase } from "@/integrations/supabase/client";

export async function getSecurityLogsClient() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const { data, error } = await supabase
    .from("security_activity_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function updatePasswordClient(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function requestEmailChangeClient(newEmail: string) {
  const { data: existingUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", newEmail)
    .maybeSingle();

  if (existingUser) throw new Error("Este e-mail já está em uso.");

  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw new Error(error.message);
  return { success: true, message: "Um link de confirmação foi enviado para o seu novo e-mail." };
}

export async function listSessionsClient() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  return [{
    id: session.access_token.slice(-10),
    browser: "Sessão Ativa (Atual)",
    last_access: new Date().toISOString(),
    is_current: true,
  }];
}

export async function enrollMfaClient() {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function verifyMfaClient(factorId: string, code: string) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function unenrollMfaClient(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({
    factorId,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getMfaStatusClient() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error(error.message);
  return data;
}

export async function listFactorsClient() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  return data;
}

export async function getMfaChallengeClient(factorId: string) {
  const { data, error } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function verifyMfaChallengeClient(factorId: string, challengeId: string, code: string) {
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId,
    code,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function generateMfaBackupCodesClient(): Promise<string[]> {
  const { data, error } = await (supabase as any).rpc("generate_mfa_backup_codes");
  if (error) throw new Error(error.message);
  return (data as string[]) || [];
}

export async function listMfaBackupCodesClient() {
  const { data, error } = await (supabase as any).rpc("list_mfa_backup_codes");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function verifyMfaBackupCodeClient(code: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("verify_mfa_backup_code", {
    p_code: code.trim(),
  });
  if (error) throw new Error(error.message);
  return !!data;
}
