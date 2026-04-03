"use strict";

/* global ExtensionCommon, ExtensionAPI, Services, Cc, Ci */

var WooCommercePanel = class extends ExtensionAPI {
  getAPI(context) {
    const { extension } = context;
    let panel = null;

    console.log("WooCommercePanel: getAPI called");

    function _ensureSidebar() {
      if (panel) return panel;

      console.log("WooCommercePanel: _ensureSidebar called");

      const win = Services.wm.getMostRecentWindow("mail:3pane");
      if (!win) {
        console.error("WooCommercePanel: no mail:3pane window found");
        return null;
      }

      const doc = win.document;
      console.log("WooCommercePanel: got window, readyState:", doc.readyState);

      // Already injected?
      if (doc.getElementById("woocommerce-sidebar")) {
        console.log("WooCommercePanel: sidebar already exists in DOM");
        const content = doc.getElementById("woocommerce-sidebar-content");
        panel = { content, doc };
        return panel;
      }

      // Log available top-level element IDs for debugging
      const topIds = [];
      for (const el of doc.querySelectorAll(":scope > *, body > *, [id]")) {
        if (el.id) topIds.push(el.id);
      }
      console.log("WooCommercePanel: available IDs:", topIds.join(", "));

      // Find injection point - try multiple strategies
      let injectionParent = null;
      let insertBefore = null;

      // Strategy 1: today-pane-panel (right side where calendar/tasks are)
      const todayPane = doc.getElementById("today-pane-panel");
      if (todayPane && todayPane.parentNode) {
        console.log("WooCommercePanel: found today-pane-panel");
        injectionParent = todayPane.parentNode;
        insertBefore = todayPane;
      }

      // Strategy 2: Insert at end of tabmail's parent
      if (!injectionParent) {
        const tabmail = doc.getElementById("tabmail-container") || doc.getElementById("tabmail");
        if (tabmail && tabmail.parentNode) {
          console.log("WooCommercePanel: using tabmail parent, tabmail.id:", tabmail.id);
          injectionParent = tabmail.parentNode;
          insertBefore = tabmail.nextSibling;
        }
      }

      // Strategy 3: document body
      if (!injectionParent) {
        injectionParent = doc.body || doc.documentElement;
        insertBefore = null;
        console.log("WooCommercePanel: fallback to body/documentElement");
      }

      console.log("WooCommercePanel: injectionParent tag:", injectionParent.tagName, "id:", injectionParent.id || "(none)");

      // Create sidebar
      const sidebar = doc.createElement("div");
      sidebar.id = "woocommerce-sidebar";
      sidebar.style.cssText = `
        width: 300px;
        min-width: 200px;
        max-width: 500px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: var(--layout-background-0, -moz-Dialog);
        color: var(--layout-color-0, -moz-DialogText);
        font-family: -moz-default;
        font-size: 12px;
        flex-shrink: 0;
        border-left: 1px solid var(--splitter-color, ThreeDShadow);
      `;

      // Header
      const header = doc.createElement("div");
      header.style.cssText = `
        display: flex;
        align-items: center;
        padding: 8px 10px;
        font-weight: bold;
        font-size: 13px;
        border-bottom: 1px solid var(--splitter-color, ThreeDShadow);
        background: var(--layout-background-1, -moz-Dialog);
        flex-shrink: 0;
      `;
      header.textContent = "WooCommerce";

      // Content area
      const content = doc.createElement("div");
      content.id = "woocommerce-sidebar-content";
      content.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 10px;
      `;

      sidebar.appendChild(header);
      sidebar.appendChild(content);

      if (insertBefore) {
        injectionParent.insertBefore(sidebar, insertBefore);
      } else {
        injectionParent.appendChild(sidebar);
      }

      panel = { content, doc, sidebar };
      console.log("WooCommercePanel: sidebar injected successfully");
      return panel;
    }

    return {
      WooCommercePanel: {
        async updatePanel(state) {
          console.log("WooCommercePanel: updatePanel called, type:", state.type);
          const p = _ensureSidebar();
          if (!p) {
            console.error("WooCommercePanel: could not create sidebar");
            return;
          }
          _updatePanelContent(p, state);
        },
      },
    };

    function _updatePanelContent(panel, state) {
      const { content, doc } = panel;
      while (content.firstChild) {
        content.removeChild(content.firstChild);
      }

      switch (state.type) {
        case "loading": {
          const p = doc.createElement("div");
          p.style.cssText = "padding: 12px 0; font-style: italic; color: #666;";
          p.textContent = _msg("loading");
          content.appendChild(p);
          break;
        }

        case "not_configured": {
          const p = doc.createElement("div");
          p.style.cssText = "padding: 12px 0; font-style: italic; color: #666;";
          p.textContent = _msg("notConfigured");
          content.appendChild(p);
          break;
        }

        case "customer_not_found": {
          const p = doc.createElement("div");
          p.style.cssText = "padding: 12px 0; font-style: italic; color: #666;";
          p.textContent = _msg("customerNotFound");
          content.appendChild(p);
          break;
        }

        case "no_orders": {
          const p = doc.createElement("div");
          p.style.cssText = "padding: 12px 0; font-style: italic; color: #666;";
          p.textContent = _msg("noOrders");
          content.appendChild(p);
          break;
        }

        case "error": {
          const p = doc.createElement("div");
          p.style.cssText = "padding: 12px 0; color: #dc3545;";
          p.textContent = state.message || _msg("errorFetching");
          content.appendChild(p);
          break;
        }

        case "orders":
          _renderOrders(panel, state);
          break;
      }
    }

    function _renderOrders(panel, state) {
      const { content, doc } = panel;

      const totalDiv = doc.createElement("div");
      totalDiv.style.cssText =
        "font-weight: bold; margin-bottom: 8px; font-size: 13px; padding: 4px 0;";

      const formattedTotal = _formatCurrency(state.totalValue, state.currency);
      let totalText = `${_msg("totalOrderValue")}: ${formattedTotal}`;
      if (state.mixedCurrencies) {
        totalText += ` ${_msg("mixedCurrencies")}`;
      }
      totalDiv.textContent = totalText;
      content.appendChild(totalDiv);

      for (const order of state.orders) {
        const card = doc.createElement("div");
        card.style.cssText = `
          padding: 6px 0;
          border-bottom: 1px solid var(--splitter-color, #ddd);
        `;

        const topRow = doc.createElement("div");
        topRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;";

        const link = doc.createElement("a");
        link.textContent = _msg("orderNumber", [String(order.number)]);
        link.href = `${state.shopUrl}/wp-admin/admin.php?page=wc-orders&action=edit&id=${order.id}`;
        link.title = link.href;
        link.style.cssText =
          "color: var(--link-color, -moz-nativehyperlinktext); text-decoration: none; font-weight: bold;";
        link.addEventListener("click", (e) => {
          e.preventDefault();
          try {
            const topWin = Services.wm.getMostRecentWindow("mail:3pane");
            if (topWin && topWin.openLinkExternally) {
              topWin.openLinkExternally(link.href);
            }
          } catch (ex) {
            console.error("WooCommercePanel: Could not open link:", ex);
          }
        });
        topRow.appendChild(link);

        const totalSpan = doc.createElement("span");
        totalSpan.textContent = _formatCurrency(order.total, order.currency);
        totalSpan.style.cssText = "font-weight: bold;";
        topRow.appendChild(totalSpan);

        card.appendChild(topRow);

        const bottomRow = doc.createElement("div");
        bottomRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; font-size: 11px;";

        const dateSpan = doc.createElement("span");
        dateSpan.textContent = _formatDate(order.date);
        dateSpan.style.cssText = "color: #666;";
        bottomRow.appendChild(dateSpan);

        const badge = doc.createElement("span");
        badge.textContent = _statusLabel(order.status);
        badge.style.cssText = `
          display: inline-block;
          padding: 1px 6px;
          border-radius: 3px;
          font-size: 10px;
          color: white;
          background: ${_statusColor(order.status)};
        `;
        bottomRow.appendChild(badge);

        card.appendChild(bottomRow);
        content.appendChild(card);
      }
    }

    function _msg(key, args) {
      try {
        return extension.localeData.localizeMessage(key, args);
      } catch (e) {
        return key;
      }
    }

    function _formatCurrency(amount, currency) {
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: currency,
        }).format(parseFloat(amount));
      } catch (e) {
        return `${currency} ${amount}`;
      }
    }

    function _formatDate(dateStr) {
      try {
        return new Intl.DateTimeFormat(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(new Date(dateStr));
      } catch (e) {
        return dateStr;
      }
    }

    function _statusColor(status) {
      const colors = {
        completed: "#28a745",
        processing: "#007bff",
        "on-hold": "#e68a00",
        pending: "#e68a00",
        refunded: "#dc3545",
        cancelled: "#dc3545",
        failed: "#dc3545",
      };
      return colors[status] || "#6c757d";
    }

    function _statusLabel(status) {
      const keyMap = {
        completed: "statusCompleted",
        processing: "statusProcessing",
        "on-hold": "statusOnHold",
        pending: "statusPending",
        refunded: "statusRefunded",
        cancelled: "statusCancelled",
        failed: "statusFailed",
      };
      const key = keyMap[status];
      return key ? _msg(key) : status;
    }
  }
};
