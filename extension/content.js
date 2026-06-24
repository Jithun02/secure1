let appOrigin = "http://localhost:5173";

async function encryptData(data, key) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(data));

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    dataBuffer
  );

  return {
    iv: Array.from(iv),
    cipherText: Array.from(new Uint8Array(cipher))
  };
}

async function decryptData(encryptedPayload, key) {
  const iv = new Uint8Array(encryptedPayload.iv);
  const cipherText = new Uint8Array(encryptedPayload.cipherText);
  const tag = new Uint8Array(encryptedPayload.tag || []);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      key,
      cipherText
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch (error) {
    console.error("[SecurePass] Decryption failed:", error);
    return null;
  }
}

async function deriveKey(secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  return crypto.subtle.importKey("raw", keyData, "PBKDF2", false, [
    "deriveKey"
  ]);
}

async function getSessionKey() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_SESSION_KEY" }, (response) => {
      if (response && response.sessionKey) {
        const keyData = new Uint8Array(response.sessionKey);
        crypto.subtle
          .importKey("raw", keyData, "AES-GCM", false, ["decrypt", "encrypt"])
          .then(resolve)
          .catch(() => resolve(null));
      } else {
        resolve(null);
      }
    });
  });
}

function isSecurePage() {
  return window.location.protocol === "https:" ||
         window.location.hostname === "localhost";
}

function syncSessionTokenFromApp() {
  try {
    const isAppOrigin =
      window.location.origin === appOrigin ||
      window.location.origin === "http://localhost:5174";

    if (!isAppOrigin) {
      return;
    }

    const raw = window.localStorage.getItem("spm_auth_session");
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === "string" && parsed.token.length > 10) {
      chrome.runtime.sendMessage({ type: "SET_SESSION_TOKEN", token: parsed.token });
    }
  } catch (error) {
    console.warn("[SecurePass] Token sync skipped:", error);
  }
}

function findLoginFields() {
  const fields = {
    username: [],
    password: [],
    email: []
  };

  const inputs = document.querySelectorAll(
    'input[type="text"], input[type="email"], input[type="password"], input[name*="user"], input[name*="email"], input[name*="login"], input[id*="user"], input[id*="email"], input[id*="login"]'
  );

  inputs.forEach((input) => {
    const name = input.name.toLowerCase();
    const id = input.id.toLowerCase();
    const type = input.type.toLowerCase();
    const placeholder = input.placeholder.toLowerCase();

    if (type === "password") {
      fields.password.push(input);
    } else if (
      type === "email" ||
      name.includes("email") ||
      id.includes("email") ||
      placeholder.includes("email")
    ) {
      fields.email.push(input);
    } else if (
      name.includes("user") ||
      name.includes("login") ||
      id.includes("user") ||
      id.includes("login") ||
      placeholder.includes("user") ||
      placeholder.includes("username")
    ) {
      fields.username.push(input);
    }
  });

  return fields;
}

function autofillForm(credentials, fields) {
  try {

    if (credentials.username) {
      if (fields.email.length > 0) {
        fields.email[0].value = credentials.username;
        fields.email[0].dispatchEvent(new Event("input", { bubbles: true }));
        fields.email[0].dispatchEvent(new Event("change", { bubbles: true }));
      } else if (fields.username.length > 0) {
        fields.username[0].value = credentials.username;
        fields.username[0].dispatchEvent(new Event("input", { bubbles: true }));
        fields.username[0].dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    if (credentials.password && fields.password.length > 0) {
      const passwordField = fields.password[0];
      passwordField.value = credentials.password;
      passwordField.dispatchEvent(new Event("input", { bubbles: true }));
      passwordField.dispatchEvent(new Event("change", { bubbles: true }));
      passwordField.dispatchEvent(new Event("focus", { bubbles: true }));
    }

    const form = fields.password[0]?.form || fields.username[0]?.form;
    if (form) {
      form.dispatchEvent(new Event("submit", { bubbles: true }));
    }

    console.log("[SecurePass] ✅ Autofill completed successfully");
    return true;
  } catch (error) {
    console.error("[SecurePass] Autofill error:", error);
    return false;
  }
}

async function requestCredentials(siteName, siteUrl) {
  if (!isSecurePage()) {
    console.warn("[SecurePass] ⚠️  Insecure page - autofill disabled");
    return null;
  }

  try {
    const sessionKey = await getSessionKey();
    if (!sessionKey) {
      console.warn("[SecurePass] No session key available");
      return null;
    }

    const request = {
      siteName,
      siteUrl,
      hostname: window.location.hostname,
      timestamp: Date.now()
    };

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "REQUEST_CREDENTIALS",
          payload: request,
          origin: window.location.origin
        },
        async (response) => {
          if (response && response.encryptedCredentials) {
            try {

              const credentials = await decryptData(
                response.encryptedCredentials,
                sessionKey
              );

              if (credentials) {
                console.log(
                  "[SecurePass] ✅ Credentials received (encrypted pipeline)"
                );
                resolve(credentials);
              } else {
                console.warn("[SecurePass] Failed to decrypt credentials");
                resolve(null);
              }
            } catch (error) {
              console.error("[SecurePass] Decryption error:", error);
              resolve(null);
            }
          } else {
            console.warn("[SecurePass] No credentials received");
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    console.error("[SecurePass] Request error:", error);
    return null;
  }
}

function createAutofillButton() {
  const button = document.createElement("button");
  button.id = "securepass-autofill-btn";
  button.innerHTML = "🔐 Autofill";
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    padding: 10px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    transition: all 0.3s ease;
  `;

  button.addEventListener("mouseenter", () => {
    button.style.transform = "scale(1.05)";
    button.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.6)";
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "scale(1)";
    button.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
  });

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.innerHTML = "⏳ Loading...";

    const siteName = document.title || window.location.hostname;
    const siteUrl = window.location.href;

    const credentials = await requestCredentials(siteName, siteUrl);

    if (credentials) {
      const fields = findLoginFields();
      const filled = autofillForm(credentials, fields);

      if (filled) {
        button.innerHTML = "✅ Autofilled!";
        setTimeout(() => {
          button.innerHTML = "🔐 Autofill";
          button.disabled = false;
        }, 2000);
      } else {
        button.innerHTML = "❌ Failed";
        setTimeout(() => {
          button.innerHTML = "🔐 Autofill";
          button.disabled = false;
        }, 2000);
      }
    } else {
      button.innerHTML = "❌ No Credentials";
      setTimeout(() => {
        button.innerHTML = "🔐 Autofill";
        button.disabled = false;
      }, 2000);
    }
  });

  return button;
}

function initializeAutofill() {

  chrome.storage.local.get("autofillEnabled", (result) => {
    if (result.autofillEnabled === false) {
      console.log("[SecurePass] Autofill disabled");
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setupAutofill);
    } else {
      setupAutofill();
    }
  });
}

function setupAutofill() {
  if (!isSecurePage()) {
    return;
  }

  const existingButton = document.getElementById("securepass-autofill-btn");
  if (!existingButton) {
    const button = createAutofillButton();
    document.body.appendChild(button);
  }

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "L") {
      event.preventDefault();
      const button = document.getElementById("securepass-autofill-btn");
      if (button) {
        button.click();
      }
    }
  });

  console.log("[SecurePass] ✅ Autofill initialized on", window.location.hostname);
}

syncSessionTokenFromApp();
initializeAutofill();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "AUTOFILL_TRIGGERED") {
    (async () => {
      const siteName = document.title || window.location.hostname;
      const siteUrl = window.location.href;
      const credentials = await requestCredentials(siteName, siteUrl);

      if (credentials) {
        const fields = findLoginFields();
        autofillForm(credentials, fields);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false });
      }
    })();
    return true;
  }
});
