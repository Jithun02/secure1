function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function hasWebAuthnSupport(): boolean {
  return (
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials !== "undefined"
  );
}

export async function enrollBiometric(email: string, username: string): Promise<void> {
  if (!hasWebAuthnSupport()) {
    throw new Error("Biometric authentication is not supported on this browser/device.");
  }

  const optionsResponse = await fetch("/api/auth/biometric/register/options", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(localStorage.getItem("spm_auth_session")
        ? {
            Authorization: `Bearer ${JSON.parse(localStorage.getItem("spm_auth_session") || "{}")?.token || ""}`,
          }
        : {}),
    },
  });

  const optionsJson = await optionsResponse.json();
  if (!optionsResponse.ok) {
    throw new Error(optionsJson?.error || "Unable to initialize biometric enrollment");
  }

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: toArrayBuffer(base64UrlToBytes(optionsJson.challenge)),
    rp: optionsJson.rp,
    user: {
      id: toArrayBuffer(base64UrlToBytes(optionsJson.user.id)),
      name: optionsJson.user.name || email,
      displayName: optionsJson.user.displayName || username || email,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "required",
      userVerification: "required",
    },
    timeout: 60000,
    attestation: "none",
  };

  const created = (await navigator.credentials.create({
    publicKey,
  })) as PublicKeyCredential | null;

  if (!created) {
    throw new Error("Biometric enrollment was cancelled.");
  }

  const credentialId = bytesToBase64Url(new Uint8Array(created.rawId));
  const attestation = created.response as AuthenticatorAttestationResponse;
  const clientDataJSON = bytesToBase64Url(new Uint8Array(attestation.clientDataJSON));

  const verifyResponse = await fetch("/api/auth/biometric/register/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(localStorage.getItem("spm_auth_session")
        ? {
            Authorization: `Bearer ${JSON.parse(localStorage.getItem("spm_auth_session") || "{}")?.token || ""}`,
          }
        : {}),
    },
    body: JSON.stringify({
      credentialId,
      clientDataJSON,
    }),
  });

  const verifyJson = await verifyResponse.json();
  if (!verifyResponse.ok) {
    throw new Error(verifyJson?.error || "Biometric enrollment verification failed");
  }
}

export type BiometricLoginResult =
  | {
      requiresTwoFactor: false;
      token: string;
      user: { id: string; username: string; email: string };
    }
  | {
      requiresTwoFactor: true;
      pendingLoginToken: string;
      code: string;
      expiresInSeconds: number;
    };

export async function verifyBiometricLogin(email: string): Promise<BiometricLoginResult> {
  if (!hasWebAuthnSupport()) {
    throw new Error("Biometric authentication is not supported on this browser/device.");
  }

  const optionsResponse = await fetch("/api/auth/biometric/login/options", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const optionsJson = await optionsResponse.json();
  if (!optionsResponse.ok) {
    throw new Error(optionsJson?.error || "Unable to initialize biometric login");
  }

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: toArrayBuffer(base64UrlToBytes(optionsJson.challenge)),
      userVerification: "required",
      timeout: 60000,
      allowCredentials: [
        {
          id: toArrayBuffer(base64UrlToBytes(optionsJson.credentialId)),
          type: "public-key",
        },
      ],
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error("Biometric verification failed or was cancelled.");
  }

  const response = assertion.response as AuthenticatorAssertionResponse;
  const credentialId = bytesToBase64Url(new Uint8Array(assertion.rawId));
  const clientDataJSON = bytesToBase64Url(new Uint8Array(response.clientDataJSON));

  const verifyResponse = await fetch("/api/auth/biometric/login/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      credentialId,
      clientDataJSON,
    }),
  });

  const verifyJson = await verifyResponse.json();
  if (!verifyResponse.ok) {
    throw new Error(verifyJson?.error || "Biometric login failed");
  }

  return verifyJson as BiometricLoginResult;
}

export async function completeBiometricTwoFactorLogin(
  pendingLoginToken: string,
  code: string
): Promise<{ token: string; user: { id: string; username: string; email: string } }> {
  const response = await fetch("/api/auth/biometric/login/2fa-verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pendingLoginToken, code }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || "Two-factor verification failed");
  }

  return json as { token: string; user: { id: string; username: string; email: string } };
}

export async function disableBiometricOnServer(token: string): Promise<void> {
  const response = await fetch("/api/auth/biometric", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || "Unable to disable biometric login");
  }
}
