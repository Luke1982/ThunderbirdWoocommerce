"use strict";

/**
 * Options page logic: load, save, and test WooCommerce credentials.
 */

const shopUrlInput = document.getElementById("shopUrl");
const consumerKeyInput = document.getElementById("consumerKey");
const consumerSecretInput = document.getElementById("consumerSecret");
const httpsWarning = document.getElementById("https-warning");
const statusMessage = document.getElementById("status-message");
const saveBtn = document.getElementById("save-btn");
const testBtn = document.getElementById("test-btn");
const form = document.getElementById("settings-form");

// Apply i18n to all elements with data-i18n attributes
function applyI18n() {
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = browser.i18n.getMessage(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll("[data-i18n-placeholder]")) {
    el.placeholder = browser.i18n.getMessage(el.dataset.i18nPlaceholder);
  }
}

function showStatus(messageKey, type, args) {
  const text = args
    ? browser.i18n.getMessage(messageKey, args)
    : browser.i18n.getMessage(messageKey);
  statusMessage.textContent = text;
  statusMessage.className = type;
  statusMessage.hidden = false;
}

function hideStatus() {
  statusMessage.hidden = true;
}

// Check for HTTPS
shopUrlInput.addEventListener("input", () => {
  const url = shopUrlInput.value.trim();
  httpsWarning.hidden = !url || url.startsWith("https://") || !url.startsWith("http");
});

// Load saved settings
async function loadSettings() {
  const data = await browser.storage.local.get([
    "shopUrl",
    "consumerKey",
    "consumerSecret",
  ]);
  if (data.shopUrl) shopUrlInput.value = data.shopUrl;
  if (data.consumerKey) consumerKeyInput.value = data.consumerKey;
  if (data.consumerSecret) consumerSecretInput.value = data.consumerSecret;
  // Trigger HTTPS check
  shopUrlInput.dispatchEvent(new Event("input"));
}

// Save settings
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideStatus();

  await browser.storage.local.set({
    shopUrl: shopUrlInput.value.trim(),
    consumerKey: consumerKeyInput.value.trim(),
    consumerSecret: consumerSecretInput.value.trim(),
  });

  showStatus("saved", "success");
});

// Test connection
testBtn.addEventListener("click", async () => {
  hideStatus();
  testBtn.disabled = true;

  const shopUrl = shopUrlInput.value.trim();
  const consumerKey = consumerKeyInput.value.trim();
  const consumerSecret = consumerSecretInput.value.trim();

  if (!shopUrl || !consumerKey || !consumerSecret) {
    showStatus("notConfigured", "error");
    testBtn.disabled = false;
    return;
  }

  try {
    const credentials = btoa(`${consumerKey}:${consumerSecret}`);
    const url = `${shopUrl.replace(/\/+$/, "")}/wp-json/wc/v3/system_status`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      showStatus("connectionSuccess", "success");
    } else if (response.status === 401 || response.status === 403) {
      showStatus("connectionFailed", "error", [
        browser.i18n.getMessage("authError"),
      ]);
    } else {
      showStatus("connectionFailed", "error", [
        `HTTP ${response.status}`,
      ]);
    }
  } catch (err) {
    showStatus("connectionFailed", "error", [err.message]);
  }

  testBtn.disabled = false;
});

// Initialize
applyI18n();
loadSettings();
