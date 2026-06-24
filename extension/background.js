const sessionKeys = new Map();

const PASSWORD_MANAGER_API = "http://localhost:5060/api";

function verifyOrigin(origin) {
  if (!origin || typeof origin !== "string") {
    return false;
  }

  return origin.startsWith("https://") || origin.startsWith("http://localhost");
}

function isAllowedTargetUrl(tabUrl) {
  if (!tabUrl || typeof tabUrl !== "string") {
    return false;
  }

  return tabUrl.startsWith("https://") || tabUrl.startsWith("http://localhost");
}

async function generateSessionKey() {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function exportKey(key) {
  const exported = await crypto.subtle.exportKey("raw", key);
  return Array.from(new Uint8Array(exported));
}

async function encryptCredentials(credentials, key) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(credentials));

  const iv = crypto.getRandomValues(new Uint8Array(12));

  try {
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      dataBuffer
    );

    return {
      iv: Array.from(iv),
      cipherText: Array.from(new Uint8Array(encrypted)),
      tag: Array.from(new Uint8Array(encrypted.slice(-16)))
    };
  } catch (error) {
    console.error("[SecurePass] Encryption error:", error);
    return null;
  }
}

function matchSiteToPassword(siteUrl, storedUrl) {
  try {
    const siteHost = new URL(siteUrl).hostname;
    const storedHost = new URL(storedUrl).hostname;
    return siteHost === storedHost || storedHost.includes(siteHost) || siteHost.includes(storedHost);
  } catch {
    return siteUrl.includes(storedUrl) || storedUrl.includes(siteUrl);
  }
}

async function fetchCredentialsFromManager(siteName, siteUrl, sessionToken) {
  try {
    const response = await fetch(`${PASSWORD_MANAGER_API}/autofill/get-credentials`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ siteName, siteUrl })
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.credentials || null;
  } catch (error) {
    console.error("[SecurePass] Failed to fetch credentials:", error);
    return null;
  }
}

async function findMatchingCredentials(siteName, siteUrl, sessionToken) {
  try {
    return await fetchCredentialsFromManager(siteName, siteUrl, sessionToken);
  } catch (error) {
    console.error("[SecurePass] Credential matching error:", error);
    return null;
  }
}

async function getOrCreateSessionKey(tabId) {
  if (!sessionKeys.has(tabId)) {
    const key = await generateSessionKey();
    sessionKeys.set(tabId, key);

    setTimeout(() => {
      sessionKeys.delete(tabId);
    }, 60 * 60 * 1000);
  }

  return sessionKeys.get(tabId);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "REQUEST_CREDENTIALS") {
    (async () => {
      try {

        if (!verifyOrigin(request.origin)) {
          console.warn("[SecurePass] ⚠️  Unauthorized origin:", request.origin);
          sendResponse({ error: "Unauthorized origin" });
          return;
        }

        chrome.storage.local.get("sessionToken", async (result) => {
          if (!result.sessionToken) {
            console.warn("[SecurePass] No session token available");
            sendResponse({ error: "Not authenticated" });
            return;
          }

          const sessionToken = result.sessionToken;

          if (!sender.tab || !isAllowedTargetUrl(sender.tab.url)) {
            sendResponse({ error: "Unsupported target URL" });
            return;
          }

          const credentials = await findMatchingCredentials(
            request.payload.siteName,
            request.payload.siteUrl,
            sessionToken
          );

          if (!credentials) {
            console.log("[SecurePass] No matching credentials found");
            sendResponse({ error: "No credentials found" });
            return;
          }

          const sessionKey = await getOrCreateSessionKey(sender.tab.id);

          const encryptedCredentials = await encryptCredentials(
            credentials,
            sessionKey
          );

          if (!encryptedCredentials) {
            sendResponse({ error: "Encryption failed" });
            return;
          }

          console.log("[SecurePass] ✅ Credentials encrypted and sent");
          sendResponse({ encryptedCredentials });
        });
      } catch (error) {
        console.error("[SecurePass] Request handler error:", error);
        sendResponse({ error: "Internal error" });
      }
    })();

    return true;
  }

  if (request.type === "GET_SESSION_KEY") {
    (async () => {
      const sessionKey = await getOrCreateSessionKey(sender.tab.id);
      const exported = await exportKey(sessionKey);
      sendResponse({ sessionKey: exported });
    })();
    return true;
  }

  if (request.type === "SET_SESSION_TOKEN") {
    chrome.storage.local.set({ sessionToken: request.token }, () => {
      console.log("[SecurePass] Session token stored securely");
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === "CLEAR_SESSION") {
    chrome.storage.local.remove(["sessionToken"], () => {
      sessionKeys.clear();
      console.log("[SecurePass] Session cleared");
      sendResponse({ success: true });
    });
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  sessionKeys.delete(tabId);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_AUTOFILL_STATUS") {
    chrome.storage.local.get("autofillEnabled", (result) => {
      sendResponse({ enabled: result.autofillEnabled !== false });
    });
    return true;
  }

  if (request.type === "TOGGLE_AUTOFILL") {
    chrome.storage.local.set({ autofillEnabled: request.enabled }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

console.log("[SecurePass] Background service worker initialized");
