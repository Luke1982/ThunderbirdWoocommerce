"use strict";

/* global ExtensionCommon, ExtensionAPI, Services */

var WooCommercePanel = class extends ExtensionAPI {
  getAPI(context) {
    const { extension } = context;
    let currentPanel = null;
    let currentMode = null;
    let statusChangeFire = null;

    return {
      WooCommercePanel: {
        async updatePanel(state, displayMode) {
          // If mode changed, destroy old panel
          if (currentMode && currentMode !== displayMode) {
            _destroyPanel();
          }
          currentMode = displayMode;

          if (!currentPanel) {
            currentPanel = _createPanel(displayMode);
          }
          if (currentPanel) {
            _updatePanelContent(currentPanel, state);
          }
        },
        onOrderStatusChangeRequested: new ExtensionCommon.EventManager({
          context,
          name: "WooCommercePanel.onOrderStatusChangeRequested",
          register(fire) {
            statusChangeFire = fire;
            return () => { statusChangeFire = null; };
          },
        }).api(),
      },
    };

    function _createPanel(mode) {
      const win = Services.wm.getMostRecentWindow("mail:3pane");
      if (!win) return null;
      const doc = win.document;

      if (mode === "messagePane") {
        return _createMessagePanePanel(win, doc);
      } else {
        return _createTodayPanePanel(win, doc);
      }
    }

    function _destroyPanel() {
      if (!currentPanel) return;
      if (currentPanel.container) currentPanel.container.remove();
      currentPanel = null;
    }

    // --- Today Pane mode: inject a box inside the today-pane-panel ---
    function _createTodayPanePanel(win, doc) {
      if (doc.getElementById("woocommerce-box")) {
        const content = doc.getElementById("woocommerce-box-content");
        return { container: doc.getElementById("woocommerce-box"), content, doc };
      }

      // Find the today pane
      const todayPane = doc.getElementById("today-pane-panel");
      if (!todayPane) {
        // Fallback: try to find it inside about:3pane
        const browser3pane = doc.getElementById("tabmail")?.currentAbout3Pane;
        if (browser3pane) {
          const innerDoc = browser3pane.document;
          const innerTodayPane = innerDoc.getElementById("today-pane-panel");
          if (innerTodayPane) {
            return _buildTodayPaneBox(innerDoc, innerTodayPane);
          }
        }
        // Last resort: append to messenger window body
        return _buildTodayPaneBox(doc, doc.body || doc.documentElement);
      }

      return _buildTodayPaneBox(doc, todayPane);
    }

    function _buildTodayPaneBox(doc, parent) {
      const container = doc.createElement("div");
      container.id = "woocommerce-box";
      container.style.cssText = `
        border-top: 1px solid var(--splitter-color, ThreeDShadow);
        background: var(--layout-background-0, -moz-Dialog);
        color: var(--layout-color-0, -moz-DialogText);
        font-family: -moz-default;
        font-size: 12px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      `;

      const header = doc.createElement("div");
      header.style.cssText = `
        display: flex;
        align-items: center;
        padding: 6px 8px;
        cursor: pointer;
        user-select: none;
        font-weight: bold;
        font-size: 11px;
        background: var(--layout-background-1, -moz-Dialog);
        border-bottom: 1px solid var(--splitter-color, ThreeDShadow);
      `;

      const toggle = doc.createElement("span");
      toggle.textContent = "\u25BC ";
      toggle.style.cssText = "margin-right: 4px; font-size: 9px;";

      const titleSpan = doc.createElement("span");
      titleSpan.textContent = _msg("panelTitle");

      header.appendChild(toggle);
      header.appendChild(titleSpan);

      const content = doc.createElement("div");
      content.id = "woocommerce-box-content";
      content.style.cssText = `
        padding: 8px;
        max-height: 300px;
        overflow-y: auto;
      `;

      let collapsed = false;
      header.addEventListener("click", () => {
        collapsed = !collapsed;
        content.style.display = collapsed ? "none" : "block";
        toggle.textContent = collapsed ? "\u25B6 " : "\u25BC ";
      });

      container.appendChild(header);
      container.appendChild(content);

      // Insert at the top of the today pane
      if (parent.firstChild) {
        parent.insertBefore(container, parent.firstChild);
      } else {
        parent.appendChild(container);
      }

      return { container, content, doc };
    }

    // --- Message Pane mode: inject above the message browser in about:3pane ---
    function _createMessagePanePanel(win, doc) {
      // Get the about:3pane document — this is stable across messages
      const tabmail = doc.getElementById("tabmail");
      const about3Pane = tabmail?.currentAbout3Pane;
      if (!about3Pane || !about3Pane.document) {
        return _createTodayPanePanel(win, doc);
      }

      const innerDoc = about3Pane.document;

      // If already injected, reuse it
      if (innerDoc.getElementById("woocommerce-box")) {
        const content = innerDoc.getElementById("woocommerce-box-content");
        return { container: innerDoc.getElementById("woocommerce-box"), content, doc: innerDoc };
      }

      // Find the messageBrowser element in the 3pane document
      const messageBrowser =
        innerDoc.getElementById("messageBrowser") ||
        innerDoc.getElementById("messagepane");

      if (!messageBrowser) {
        return _createTodayPanePanel(win, doc);
      }

      const container = innerDoc.createElement("div");
      container.id = "woocommerce-box";
      container.style.cssText = `
        border-bottom: 1px solid var(--splitter-color, ThreeDShadow);
        font-family: -moz-default;
        font-size: 12px;
        background: var(--layout-background-0, -moz-Dialog);
        color: var(--layout-color-0, -moz-DialogText);
      `;

      const header = innerDoc.createElement("div");
      header.style.cssText = `
        display: flex;
        align-items: center;
        padding: 4px 8px;
        cursor: pointer;
        user-select: none;
        font-weight: bold;
        font-size: 11px;
      `;

      const toggle2 = innerDoc.createElement("span");
      toggle2.textContent = "\u25BC ";
      toggle2.style.cssText = "margin-right: 4px; font-size: 9px;";

      const titleSpan2 = innerDoc.createElement("span");
      titleSpan2.textContent = _msg("panelTitle");

      header.appendChild(toggle2);
      header.appendChild(titleSpan2);

      const content = innerDoc.createElement("div");
      content.id = "woocommerce-box-content";
      content.style.cssText = `
        padding: 6px 8px;
        max-height: 300px;
        overflow-y: auto;
      `;

      let collapsed2 = false;
      header.addEventListener("click", () => {
        collapsed2 = !collapsed2;
        content.style.display = collapsed2 ? "none" : "block";
        toggle2.textContent = collapsed2 ? "\u25B6 " : "\u25BC ";
      });

      container.appendChild(header);
      container.appendChild(content);

      // Insert right before the messageBrowser
      messageBrowser.parentNode.insertBefore(container, messageBrowser);

      return { container, content, doc: innerDoc };
    }

    // --- Content rendering ---
    function _updatePanelContent(panel, state) {
      const { content, doc } = panel;
      while (content.firstChild) {
        content.removeChild(content.firstChild);
      }

      switch (state.type) {
        case "loading": {
          const p = doc.createElement("div");
          p.style.cssText = "padding: 8px 0; font-style: italic; color: #666;";
          p.textContent = _msg("loading");
          content.appendChild(p);
          break;
        }

        case "not_configured": {
          const p = doc.createElement("div");
          p.style.cssText = "padding: 8px 0; font-style: italic; color: #666;";
          p.textContent = _msg("notConfigured");
          content.appendChild(p);
          break;
        }

        case "customer_not_found": {
          const p = doc.createElement("div");
          p.style.cssText = "padding: 8px 0; font-style: italic; color: #666;";
          p.textContent = _msg("customerNotFound");
          content.appendChild(p);
          break;
        }

        case "no_orders": {
          const p = doc.createElement("div");
          p.style.cssText = "padding: 8px 0; font-style: italic; color: #666;";
          p.textContent = _msg("noOrders");
          content.appendChild(p);
          break;
        }

        case "error": {
          const p = doc.createElement("div");
          p.style.cssText = "padding: 8px 0; color: #dc3545;";
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

      // Remove any leftover context menu
      const oldMenu = doc.getElementById("woocommerce-ctx-menu");
      if (oldMenu) oldMenu.remove();

      const totalDiv = doc.createElement("div");
      totalDiv.style.cssText =
        "font-weight: bold; margin-bottom: 6px; font-size: 12px;";

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
          padding: 4px 0;
          border-bottom: 1px solid var(--splitter-color, #ddd);
        `;

        const topRow = doc.createElement("div");
        topRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;";

        const link = doc.createElement("a");
        link.textContent = _msg("orderNumber", [String(order.number)]);
        link.href = `${state.shopUrl}/wp-admin/admin.php?page=wc-orders&action=edit&id=${order.id}`;
        link.title = link.href;
        link.style.cssText =
          "color: var(--link-color, -moz-nativehyperlinktext); text-decoration: none; font-weight: bold; font-size: 11px;";
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
        totalSpan.style.cssText = "font-weight: bold; font-size: 11px;";
        topRow.appendChild(totalSpan);

        card.appendChild(topRow);

        const bottomRow = doc.createElement("div");
        bottomRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; font-size: 10px;";

        const dateSpan = doc.createElement("span");
        dateSpan.textContent = _formatDate(order.date);
        dateSpan.style.cssText = "color: #666;";
        bottomRow.appendChild(dateSpan);

        const badge = doc.createElement("span");
        badge.textContent = _statusLabel(order.status);
        badge.style.cssText = `
          display: inline-block;
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 9px;
          color: white;
          background: ${_statusColor(order.status)};
        `;
        bottomRow.appendChild(badge);

        card.appendChild(bottomRow);

        // Right-click context menu for status change
        card.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          _showStatusMenu(doc, e, order);
        });

        content.appendChild(card);
      }
    }

    function _showStatusMenu(doc, event, order) {
      // Remove any existing menu
      const old = doc.getElementById("woocommerce-ctx-menu");
      if (old) old.remove();

      const statuses = [
        "pending", "processing", "on-hold", "completed",
        "cancelled", "refunded", "failed",
      ];

      const menu = doc.createElement("div");
      menu.id = "woocommerce-ctx-menu";
      menu.style.cssText = `
        position: fixed;
        z-index: 99999;
        background: var(--layout-background-0, -moz-Dialog);
        border: 1px solid var(--splitter-color, ThreeDShadow);
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        padding: 4px 0;
        font-size: 11px;
        font-family: -moz-default;
        min-width: 140px;
      `;

      const header = doc.createElement("div");
      header.style.cssText = `
        padding: 4px 10px;
        font-weight: bold;
        font-size: 10px;
        color: #666;
        border-bottom: 1px solid var(--splitter-color, #ddd);
        margin-bottom: 2px;
      `;
      header.textContent = _msg("changeStatus");
      menu.appendChild(header);

      for (const status of statuses) {
        const item = doc.createElement("div");
        item.style.cssText = `
          padding: 4px 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        `;

        const dot = doc.createElement("span");
        dot.style.cssText = `
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${_statusColor(status)};
        `;
        item.appendChild(dot);

        const label = doc.createElement("span");
        label.textContent = _statusLabel(status);
        item.appendChild(label);

        if (status === order.status) {
          item.style.fontWeight = "bold";
          item.style.opacity = "0.5";
          item.style.cursor = "default";
        } else {
          item.addEventListener("mouseenter", () => {
            item.style.background = "var(--layout-background-2, Highlight)";
          });
          item.addEventListener("mouseleave", () => {
            item.style.background = "none";
          });
          item.addEventListener("click", () => {
            menu.remove();
            if (statusChangeFire) {
              statusChangeFire.async(order.id, status);
            }
          });
        }

        menu.appendChild(item);
      }

      doc.body.appendChild(menu);

      // Position: ensure it stays within viewport
      const rect = menu.getBoundingClientRect();
      let x = event.clientX;
      let y = event.clientY;
      const vw = doc.documentElement.clientWidth;
      const vh = doc.documentElement.clientHeight;
      if (x + rect.width > vw) x = vw - rect.width - 4;
      if (y + rect.height > vh) y = vh - rect.height - 4;
      menu.style.left = x + "px";
      menu.style.top = y + "px";

      // Close on any click/mousedown outside, right-click, or Escape
      const closeMenu = () => {
        menu.remove();
        doc.removeEventListener("mousedown", outsideHandler, true);
        doc.removeEventListener("contextmenu", outsideHandler, true);
        doc.removeEventListener("keydown", keyHandler, true);
      };
      const outsideHandler = (e) => {
        if (!menu.contains(e.target)) {
          e.preventDefault();
          e.stopPropagation();
          closeMenu();
        }
      };
      const keyHandler = (e) => {
        if (e.key === "Escape") closeMenu();
      };
      setTimeout(() => {
        doc.addEventListener("mousedown", outsideHandler, true);
        doc.addEventListener("contextmenu", outsideHandler, true);
        doc.addEventListener("keydown", keyHandler, true);
      }, 0);
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
