const PASSWORD_MANAGER_URL = "http://localhost:5173";

function checkAuthStatus() {
  chrome.storage.local.get("sessionToken", (result) => {
    const authStatus = document.getElementById("authStatus");
    const authStatusText = document.getElementById("authStatusText");

    if (result.sessionToken) {
      authStatus.classList.remove("offline");
      authStatusText.textContent = "✓ Authenticated";
      authStatusText.style.color = "#4CAF50";
    } else {
      authStatus.classList.add("offline");
      authStatusText.textContent = "Not authenticated";
      authStatusText.style.color = "#f44336";
    }
  });
}

function checkConnection() {
  fetch(`${PASSWORD_MANAGER_URL}/api/health`)
    .then((response) => {
      const connStatus = document.getElementById("connStatus");
      const connStatusText = document.getElementById("connStatusText");

      if (response.ok) {
        connStatus.classList.remove("offline");
        connStatusText.textContent = "✓ Connected";
        connStatusText.style.color = "#4CAF50";
      } else {
        throw new Error("Connection failed");
      }
    })
    .catch(() => {
      const connStatus = document.getElementById("connStatus");
      const connStatusText = document.getElementById("connStatusText");

      connStatus.classList.add("offline");
      connStatusText.textContent = "Not connected";
      connStatusText.style.color = "#f44336";
    });
}

function updateAutofillToggle() {
  chrome.runtime.sendMessage({ type: "GET_AUTOFILL_STATUS" }, (response) => {
    const toggle = document.getElementById("autofillToggle");
    if (response.enabled) {
      toggle.classList.add("enabled");
    } else {
      toggle.classList.remove("enabled");
    }
  });
}

function toggleAutofill() {
  chrome.runtime.sendMessage({ type: "GET_AUTOFILL_STATUS" }, (response) => {
    const newState = !response.enabled;
    chrome.runtime.sendMessage(
      { type: "TOGGLE_AUTOFILL", enabled: newState },
      () => {
        updateAutofillToggle();
        showMessage(
          newState ? "✓ Autofill enabled" : "Autofill disabled",
          "success"
        );
      }
    );
  });
}

function showMessage(text, type = "success") {
  const messageEl = document.getElementById(
    type === "success" ? "successMessage" : "errorMessage"
  );
  messageEl.textContent = text;
  messageEl.style.display = "block";

  setTimeout(() => {
    messageEl.style.display = "none";
  }, 3000);
}

function openPasswordManager() {
  chrome.storage.local.get("sessionToken", (result) => {
    if (!result.sessionToken) {
      chrome.tabs.create({ url: PASSWORD_MANAGER_URL });
    } else {
      chrome.tabs.create({ url: `${PASSWORD_MANAGER_URL}/dashboard` });
    }
  });
}

function logout() {
  if (confirm("Are you sure you want to logout?")) {
    chrome.runtime.sendMessage({ type: "CLEAR_SESSION" }, () => {
      chrome.storage.local.remove(["sessionToken"], () => {
        checkAuthStatus();
        showMessage("✓ Logged out successfully", "success");
      });
    });
  }
}

function openSettings() {
  chrome.tabs.create({ url: `${PASSWORD_MANAGER_URL}/settings` });
}

function initialize() {

  checkConnection();
  checkAuthStatus();
  updateAutofillToggle();

  document
    .getElementById("autofillToggle")
    .addEventListener("click", toggleAutofill);
  document
    .getElementById("openManagerBtn")
    .addEventListener("click", openPasswordManager);
  document
    .getElementById("logoutBtn")
    .addEventListener("click", logout);
  document
    .getElementById("settingsBtn")
    .addEventListener("click", openSettings);

  setInterval(() => {
    checkConnection();
    checkAuthStatus();
  }, 5000);
}

document.addEventListener("DOMContentLoaded", initialize);
