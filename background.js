"use strict";

/**
 * Background script — orchestrates WooCommerce lookups
 * when messages are displayed.
 *
 * Uses standard messageDisplay API (works with Conversations plugin).
 * Depends on: woocommerce-api.js (loaded first, provides global `wooCommerce`)
 */

browser.messageDisplay.onMessageDisplayed.addListener(async (tab, message) => {
  try {
    // Extract sender email from the message
    const author = message.author || "";
    const emailMatch = author.match(/<([^>]+)>/) || [null, author.trim()];
    const email = emailMatch[1];

    if (!email || !email.includes("@")) return;

    const senderEmail = email.toLowerCase().trim();

    // Show loading state immediately
    await browser.WooCommercePanel.updatePanel({ type: "loading" });

    // Look up customer and orders
    const result = await wooCommerce.lookupByEmail(senderEmail);

    if (result.type === "orders") {
      // Add shopUrl so the panel can build order links
      const config = await wooCommerce.getConfig();
      result.shopUrl = config ? config.shopUrl : "";
    }

    await browser.WooCommercePanel.updatePanel(result);
  } catch (err) {
    let message;
    if (err.message === "auth_error") {
      message = browser.i18n.getMessage("authError");
    } else {
      message =
        browser.i18n.getMessage("errorFetching") + ": " + err.message;
    }
    await browser.WooCommercePanel.updatePanel({
      type: "error",
      message,
    });
  }
});
