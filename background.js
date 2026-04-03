"use strict";

/**
 * Background script — orchestrates WooCommerce lookups
 * when messages are displayed.
 *
 * Depends on: woocommerce-api.js (loaded first, provides global `wooCommerce`)
 */

browser.WooCommercePanel.onMessageDisplayed.addListener(
  async (tabId, senderEmail) => {
    try {
      // Show loading state immediately
      await browser.WooCommercePanel.updatePanel(tabId, { type: "loading" });

      // Look up customer and orders
      const result = await wooCommerce.lookupByEmail(senderEmail);

      if (result.type === "orders") {
        // Add shopUrl so the panel can build order links
        const config = await wooCommerce.getConfig();
        result.shopUrl = config ? config.shopUrl : "";
      }

      await browser.WooCommercePanel.updatePanel(tabId, result);
    } catch (err) {
      let message;
      if (err.message === "auth_error") {
        message = browser.i18n.getMessage("authError");
      } else {
        message =
          browser.i18n.getMessage("errorFetching") + ": " + err.message;
      }
      await browser.WooCommercePanel.updatePanel(tabId, {
        type: "error",
        message,
      });
    }
  }
);
