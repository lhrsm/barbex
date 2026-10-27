/**
 * Utilitário de validação e normalização de chaves PIX para o Barbex
 * Suporta: CPF, CNPJ, Telefone, E-mail e Chave Aleatória (EVP).
 */

export type PixKeyType = "cpf" | "cnpj" | "phone" | "email" | "random";

export const PIX_KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "phone", label: "Telefone / Celular" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Chave Aleatória (EVP)" },
];

/**
 * Validação do algoritmo de CPF (dígitos verificadores módulo 11)
 */
function isValidCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

/**
 * Validação do algoritmo de CNPJ (dígitos verificadores)
 */
function isValidCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weightsSecond = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean.charAt(i), 10) * weightsFirst[i];
  }
  let rev = sum % 11;
  const digit1 = rev < 2 ? 0 : 11 - rev;
  if (parseInt(clean.charAt(12), 10) !== digit1) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(clean.charAt(i), 10) * weightsSecond[i];
  }
  rev = sum % 11;
  const digit2 = rev < 2 ? 0 : 11 - rev;
  if (parseInt(clean.charAt(13), 10) !== digit2) return false;

  return true;
}

/**
 * Validação de telefone (formato nacional brasileiro com DDD)
 */
function isValidPhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, "");
  // Formato com código do país: 55 + DDD (2) + 8 ou 9 dígitos = 12 ou 13 dígitos
  if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
    const ddd = parseInt(clean.substring(2, 4), 10);
    return ddd >= 11 && ddd <= 99;
  }
  // Formato direto: DDD (2) + 8 ou 9 dígitos = 10 ou 11 dígitos
  if (clean.length === 10 || clean.length === 11) {
    const ddd = parseInt(clean.substring(0, 2), 10);
    return ddd >= 11 && ddd <= 99;
  }
  return false;
}

/**
 * Validação de e-mail padrão RFC 5322 simplificada
 */
function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return re.test(trimmed);
}

/**
 * Validação de chave aleatória PIX (EVP / UUIDv4 de 32 ou 36 caracteres)
 */
function isValidRandomKey(key: string): boolean {
  const trimmed = key.trim();
  // Formato UUID padrão (8-4-4-4-12)
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (uuidRegex.test(trimmed)) return true;
  // Formato 32 caracteres hexadecimais contínuos
  const hex32Regex = /^[0-9a-fA-F]{32}$/;
  return hex32Regex.test(trimmed);
}

export function validatePixKey(
  key: string,
  type: PixKeyType | string,
): { isValid: boolean; error?: string } {
  if (!key || !key.trim()) {
    return { isValid: false, error: "A chave PIX não pode ser vazia." };
  }

  const trimmed = key.trim();

  switch (type) {
    case "cpf": {
      if (!isValidCPF(trimmed)) {
        return { isValid: false, error: "CPF inválido. Verifique os dígitos informados." };
      }
      return { isValid: true };
    }
    case "cnpj": {
      if (!isValidCNPJ(trimmed)) {
        return { isValid: false, error: "CNPJ inválido. Verifique os dígitos informados." };
      }
      return { isValid: true };
    }
    case "phone": {
      if (!isValidPhone(trimmed)) {
        return {
          isValid: false,
          error: "Telefone inválido. Informe o DDD e o número completo (ex: 71999999999).",
        };
      }
      return { isValid: true };
    }
    case "email": {
      if (!isValidEmail(trimmed)) {
        return { isValid: false, error: "E-mail inválido. Verifique o formato informado." };
      }
      return { isValid: true };
    }
    case "random": {
      if (!isValidRandomKey(trimmed)) {
        return {
          isValid: false,
          error: "Chave aleatória inválida. Deve seguir o padrão UUID de 32 ou 36 caracteres.",
        };
      }
      return { isValid: true };
    }
    default: {
      return { isValid: false, error: "Tipo de chave PIX não reconhecido." };
    }
  }
}

/**
 * Normaliza a chave para armazenamento consistente sem descaracterizar o dado
 */
export function normalizePixKey(key: string, type: PixKeyType | string): string {
  if (!key) return "";
  const trimmed = key.trim();

  switch (type) {
    case "cpf":
    case "cnpj":
      return trimmed.replace(/\D/g, "");
    case "phone": {
      const clean = trimmed.replace(/\D/g, "");
      // Se não começa com 55, adiciona o código do país para padrão BACEN
      if (clean.length === 10 || clean.length === 11) {
        return `+55${clean}`;
      }
      if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
        return `+${clean}`;
      }
      return trimmed;
    }
    case "email":
      return trimmed.toLowerCase();
    case "random":
      return trimmed.toLowerCase();
    default:
      return trimmed;
  }
}
