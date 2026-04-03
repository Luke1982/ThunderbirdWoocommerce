"use strict";

/**
 * Background script — orchestrates WooCommerce lookups.
 *
 * Uses both mailTabs.onSelectedMessagesChanged (Conversations compatible)
 * and messageDisplay.onMessageDisplayed (standard) to cover all cases.
 * Depends on: woocommerce-api.js (loaded first, provides global `wooCommerce`)
 */

let lastEmail = null;

async function getDisplayMode() {
  const data = await browser.storage.local.get("displayMode");
  return data.displayMode || "todayPane";
}

async function handleMessage(message) {
  if (!message || !message.author) return;

  const author = message.author;
  const emailMatch = author.match(/<([^>]+)>/) || [null, author.trim()];
  const email = emailMatch[1];

  if (!email || !email.includes("@")) return;

  const senderEmail = email.toLowerCase().trim();

  lastEmail = senderEmail;

  const displayMode = await getDisplayMode();

  try {
    await browser.WooCommercePanel.updatePanel({ type: "loading", email: senderEmail }, displayMode);

    const config = await wooCommerce.getConfig();
    const result = await wooCommerce.lookupByEmail(senderEmail);
    result.email = senderEmail;

    if (result.type === "orders") {
      result.shopUrl = config ? config.shopUrl : "";
      try {
        result.statuses = await wooCommerce.getStatuses(config);
      } catch (e) { /* use fallback in panel */ }
    }

    await browser.WooCommercePanel.updatePanel(result, displayMode);
  } catch (err) {
    let msg;
    if (err.message === "auth_error") {
      msg = browser.i18n.getMessage("authError");
    } else {
      msg = browser.i18n.getMessage("errorFetching") + ": " + err.message;
    }
    await browser.WooCommercePanel.updatePanel({ type: "error", message: msg, email: senderEmail }, displayMode);
  }
}

// Handle order status change requests from the panel
browser.WooCommercePanel.onOrderStatusChangeRequested.addListener(async (orderId, newStatus) => {
  const displayMode = await getDisplayMode();
  try {
    await browser.WooCommercePanel.updatePanel({ type: "loading", email: lastEmail }, displayMode);
    await wooCommerce.updateOrderStatus(orderId, newStatus);
    // Re-fetch and display updated orders
    const config = await wooCommerce.getConfig();
    const result = await wooCommerce.lookupByEmail(lastEmail);
    result.email = lastEmail;
    if (result.type === "orders") {
      result.shopUrl = config ? config.shopUrl : "";
      try {
        result.statuses = await wooCommerce.getStatuses(config);
      } catch (e) { /* use fallback in panel */ }
    }
    await browser.WooCommercePanel.updatePanel(result, displayMode);
  } catch (err) {
    let msg;
    if (err.message === "auth_error") {
      msg = browser.i18n.getMessage("authError");
    } else {
      msg = browser.i18n.getMessage("statusUpdateFailed") + ": " + err.message;
    }
    await browser.WooCommercePanel.updatePanel({ type: "error", message: msg, email: lastEmail }, displayMode);
  }
});

async function resetPanel() {
  lastEmail = null;
  const displayMode = await getDisplayMode();
  await browser.WooCommercePanel.updatePanel({ type: "idle" }, displayMode);
}

// Works with Conversations plugin
browser.mailTabs.onSelectedMessagesChanged.addListener(async (tab, messageList) => {
  if (messageList.messages.length === 1) {
    await handleMessage(messageList.messages[0]);
  } else {
    await resetPanel();
  }
});

// Works with standard message pane
browser.messageDisplay.onMessageDisplayed.addListener(async (tab, message) => {
  await handleMessage(message);
});
