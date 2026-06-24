export type PasswordStrength = "weak" | "fair" | "good" | "strong" | "very-strong";

export interface PasswordStrengthScore {
  strength: PasswordStrength;
  score: number;
  feedback: string[];
  color: "red" | "orange" | "yellow" | "green" | "emerald";
}

export function analyzePasswordStrength(password: string): PasswordStrengthScore {
  let score = 0;
  const feedback: string[] = [];

  if (!password) {
    return {
      strength: "weak",
      score: 0,
      feedback: ["Password is empty"],
      color: "red"
    };
  }

  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  if (password.length >= 20) score += 10;

  if (password.length < 8) {
    feedback.push("Use at least 8 characters");
  }

  if (/[a-z]/.test(password)) {
    score += 10;
  } else {
    feedback.push("Add lowercase letters");
  }

  if (/[A-Z]/.test(password)) {
    score += 10;
  } else {
    feedback.push("Add uppercase letters");
  }

  if (/[0-9]/.test(password)) {
    score += 10;
  } else {
    feedback.push("Add numbers");
  }

  if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    score += 15;
  } else {
    feedback.push("Add special characters");
  }

  if (!/(.)\1{2,}/.test(password)) {
    score += 10;
  } else {
    feedback.push("Avoid repeating characters");
  }

  let strength: PasswordStrength;
  let color: "red" | "orange" | "yellow" | "green" | "emerald";

  if (score >= 90) {
    strength = "very-strong";
    color = "emerald";
  } else if (score >= 70) {
    strength = "strong";
    color = "green";
  } else if (score >= 50) {
    strength = "good";
    color = "yellow";
  } else if (score >= 30) {
    strength = "fair";
    color = "orange";
  } else {
    strength = "weak";
    color = "red";
  }

  score = Math.min(score, 100);

  return {
    strength,
    score,
    feedback: feedback.length > 0 ? feedback : ["Strong password!"],
    color
  };
}

export async function checkPasswordBreach(password: string): Promise<boolean> {

  const commonPasswords = [
    "password",
    "123456",
    "password123",
    "admin",
    "letmein",
    "welcome",
    "monkey",
    "dragon",
    "master",
    "sunshine"
  ];

  return commonPasswords.includes(password.toLowerCase());
}

export function generateSecurePassword(
  length: number = 16,
  options: {
    uppercase?: boolean;
    lowercase?: boolean;
    numbers?: boolean;
    symbols?: boolean;
  } = {}
): string {
  const {
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true
  } = options;

  let chars = "";
  if (uppercase) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (lowercase) chars += "abcdefghijklmnopqrstuvwxyz";
  if (numbers) chars += "0123456789";
  if (symbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";

  if (!chars.length) {
    throw new Error("At least one character set must be enabled");
  }

  let password = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }

  return password;
}

export function calculateEntropy(password: string): number {
  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) charsetSize += 32;

  return Math.log2(Math.pow(charsetSize, password.length));
}

export function estimateCrackTime(password: string): string {
  const entropy = calculateEntropy(password);
  const guessesPerSecond = 1e9;
  const secondsToCrack = (Math.pow(2, entropy) / guessesPerSecond) / 2;

  if (secondsToCrack < 1) return "< 1 second";
  if (secondsToCrack < 60) return `${Math.round(secondsToCrack)} seconds`;
  if (secondsToCrack < 3600) return `${Math.round(secondsToCrack / 60)} minutes`;
  if (secondsToCrack < 86400) return `${Math.round(secondsToCrack / 3600)} hours`;
  if (secondsToCrack < 2592000) return `${Math.round(secondsToCrack / 86400)} days`;
  if (secondsToCrack < 31536000) return `${Math.round(secondsToCrack / 2592000)} months`;
  return `${Math.round(secondsToCrack / 31536000)} years`;
}
