"use strict";

/* global ExtensionCommon, ExtensionAPI */

var WooCommercePanel = class extends ExtensionAPI {
  /**
   * Called when the API is first used. Sets up the panel and message listeners.
   */
  getAPI(context) {
    const { extension } = context;

    // Track panels per window context and event listeners.
    // Each about:message context gets its own child script instance,
    // so we use a simple counter as panel ID within each context.
    let panelIdCounter = 0;
    const panels = new Map();
    let fireOnMessageDisplayed = null;

    return {
      WooCommercePanel: {
        onMessageDisplayed: new ExtensionCommon.EventManager({
          context,
          name: "WooCommercePanel.onMessageDisplayed",
          register(fire) {
            fireOnMessageDisplayed = fire;

            // Set up message display listener in the about:message window
            const windowListener = {
              onStartHeaders() {},
              onEndHeaders() {
                try {
                  const win = context.cloneScope.window;
                  if (!win || !win.gMessage) return;

                  const msg = win.gMessage;
                  const author = msg.author || "";

                  // Extract email from "Name <email>" or plain "email"
                  const emailMatch = author.match(/<([^>]+)>/) || [
                    null,
                    author.trim(),
                  ];
                  const email = emailMatch[1];

                  if (!email || !email.includes("@")) return;

                  // Use a stable panel ID for this context.
                  // Each about:message window gets one panel, keyed by ID 0.
                  const tabId = 0;

                  // Ensure panel exists for this context
                  if (!panels.has(tabId)) {
                    _createPanel(win, tabId);
                  }

                  fire.async(tabId, email.toLowerCase().trim());
                } catch (e) {
                  console.error(
                    "WooCommercePanel: Error in onEndHeaders:",
                    e
                  );
                }
              },
              onEndAttachments() {},
            };

            try {
              const win = context.cloneScope.window;
              if (win && win.gMessageListeners) {
                win.gMessageListeners.push(windowListener);
              }
            } catch (e) {
              console.error(
                "WooCommercePanel: Error registering listener:",
                e
              );
            }

            return () => {
              fireOnMessageDisplayed = null;
              try {
                const win = context.cloneScope.window;
                if (win && win.gMessageListeners) {
                  const idx = win.gMessageListeners.indexOf(windowListener);
                  if (idx >= 0) {
                    win.gMessageListeners.splice(idx, 1);
                  }
                }
              } catch (e) {
                // Window may already be closed
              }
            };
          },
        }).api(),

        async updatePanel(tabId, state) {
          const panel = panels.get(tabId);
          if (!panel) return;
          _updatePanelContent(panel, state);
        },
      },
    };

    /**
     * Create and inject the panel into the message pane.
     */
    function _createPanel(win, tabId) {
      const doc = win.document;

      // Find insertion point: after expandedHeadersTopBox
      const headerBox =
        doc.getElementById("expandedHeadersTopBox") ||
        doc.getElementById("expandedHeaders2");
      if (!headerBox) {
        console.warn(
          "WooCommercePanel: Could not find header element for panel injection"
        );
        return;
      }

      // Create panel container
      const container = doc.createElement("div");
      container.id = "woocommerce-panel";
      container.style.cssText = `
        border-bottom: 1px solid var(--splitter-color, ThreeDShadow);
        font-family: -moz-default;
        font-size: 12px;
        background: var(--layout-background-0, -moz-Dialog);
        color: var(--layout-color-0, -moz-DialogText);
      `;

      // Header bar (collapsible toggle)
      const header = doc.createElement("div");
      header.style.cssText = `
        display: flex;
        align-items: center;
        padding: 4px 8px;
        cursor: pointer;
        user-select: none;
        font-weight: bold;
        font-size: 11px;
      `;

      const toggle = doc.createElement("span");
      toggle.textContent = "\u25BC ";
      toggle.style.cssText = "margin-right: 4px; font-size: 9px;";

      const titleSpan = doc.createElement("span");
      titleSpan.textContent = _msg("panelTitle");

      header.appendChild(toggle);
      header.appendChild(titleSpan);

      // Content area
      const content = doc.createElement("div");
      content.id = "woocommerce-panel-content";
      content.style.cssText = `
        padding: 6px 8px;
        max-height: 300px;
        overflow-y: auto;
      `;
      content.textContent = _msg("loading");

      // Toggle collapse
      let collapsed = false;
      header.addEventListener("click", () => {
        collapsed = !collapsed;
        content.style.display = collapsed ? "none" : "block";
        toggle.textContent = collapsed ? "\u25B6 " : "\u25BC ";
      });

      container.appendChild(header);
      container.appendChild(content);

      // Insert after the header box
      headerBox.parentNode.insertBefore(container, headerBox.nextSibling);

      panels.set(tabId, { container, content, doc });
    }

    /**
     * Update the panel content based on state.
     */
    function _updatePanelContent(panel, state) {
      const { content, doc } = panel;
      // Clear existing content
      while (content.firstChild) {
        content.removeChild(content.firstChild);
      }

      switch (state.type) {
        case "loading":
          content.textContent = _msg("loading");
          content.style.fontStyle = "italic";
          content.style.color = "";
          break;

        case "not_configured":
          content.textContent = _msg("notConfigured");
          content.style.fontStyle = "italic";
          content.style.color = "";
          break;

        case "customer_not_found":
          content.textContent = _msg("customerNotFound");
          content.style.fontStyle = "italic";
          content.style.color = "";
          break;

        case "no_orders":
          content.textContent = _msg("noOrders");
          content.style.fontStyle = "italic";
          content.style.color = "";
          break;

        case "error":
          content.textContent = state.message || _msg("errorFetching");
          content.style.fontStyle = "normal";
          content.style.color = "red";
          break;

        case "orders":
          content.style.fontStyle = "normal";
          content.style.color = "";
          _renderOrders(panel, state);
          break;
      }
    }

    /**
     * Render the orders list in the panel.
     */
    function _renderOrders(panel, state) {
      const { content, doc } = panel;

      // Total value header
      const totalDiv = doc.createElement("div");
      totalDiv.style.cssText =
        "font-weight: bold; margin-bottom: 6px; font-size: 12px;";

      const formattedTotal = _formatCurrency(
        state.totalValue,
        state.currency
      );
      let totalText = `${_msg("totalOrderValue")}: ${formattedTotal}`;
      if (state.mixedCurrencies) {
        totalText += ` ${_msg("mixedCurrencies")}`;
      }
      totalDiv.textContent = totalText;
      content.appendChild(totalDiv);

      // Orders table
      const table = doc.createElement("table");
      table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      `;

      for (const order of state.orders) {
        const row = doc.createElement("tr");
        row.style.cssText =
          "border-bottom: 1px solid var(--splitter-color, ThreeDShadow);";

        // Order number (link)
        const numCell = doc.createElement("td");
        numCell.style.cssText = "padding: 3px 6px 3px 0;";
        const link = doc.createElement("a");
        link.textContent = _msg("orderNumber", [String(order.number)]);
        link.href = `${state.shopUrl}/wp-admin/admin.php?page=wc-orders&action=edit&id=${order.id}`;
        link.title = link.href;
        link.style.cssText =
          "color: var(--link-color, -moz-nativehyperlinktext); text-decoration: none;";
        link.addEventListener("click", (e) => {
          e.preventDefault();
          // Open in external browser
          // Note: loadURI signature may need a triggeringPrincipal in TB 128+.
          // Verify during integration testing. Alternative: use openLinkExternally().
          try {
            const win2 = content.ownerGlobal.top;
            if (win2.openLinkExternally) {
              win2.openLinkExternally(link.href);
            } else {
              const uri = Cc[
                "@mozilla.org/network/io-service;1"
              ]
                .getService(Ci.nsIIOService)
                .newURI(link.href);
              const eps = Cc[
                "@mozilla.org/uriloader/external-protocol-service;1"
              ]
                .getService(Ci.nsIExternalProtocolService);
              eps.loadURI(uri);
            }
          } catch (ex) {
            console.error("WooCommercePanel: Could not open link:", ex);
          }
        });
        numCell.appendChild(link);
        row.appendChild(numCell);

        // Date
        const dateCell = doc.createElement("td");
        dateCell.style.cssText = "padding: 3px 6px;";
        dateCell.textContent = _formatDate(order.date);
        row.appendChild(dateCell);

        // Status badge
        const statusCell = doc.createElement("td");
        statusCell.style.cssText = "padding: 3px 6px;";
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
        statusCell.appendChild(badge);
        row.appendChild(statusCell);

        // Total
        const totalCell = doc.createElement("td");
        totalCell.style.cssText =
          "padding: 3px 0 3px 6px; text-align: right;";
        totalCell.textContent = _formatCurrency(
          order.total,
          order.currency
        );
        row.appendChild(totalCell);

        table.appendChild(row);
      }

      content.appendChild(table);
    }

    // --- Helpers ---

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
