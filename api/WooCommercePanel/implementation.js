"use strict";

/* global ChromeUtils, ExtensionCommon, ExtensionAPI, Services */

var { ExtensionSupport } = ChromeUtils.importESModule(
  "resource:///modules/ExtensionSupport.sys.mjs"
);

var WooCommercePanel = class extends ExtensionAPI {
  onStartup() {
    console.log("WooCommercePanel: onStartup called");
    this._panels = new Map();

    const self = this;
    const extensionId = "woocommerce-customer-lookup@thunderbird-extension";

    ExtensionSupport.registerWindowListener(extensionId, {
      chromeURLs: ["chrome://messenger/content/messenger.xhtml"],

      onLoadWindow(win) {
        console.log("WooCommercePanel: onLoadWindow fired");
        // Delay injection to ensure the window is fully initialized
        win.setTimeout(() => {
          self._injectSidebar(win);
        }, 500);
      },

      onUnloadWindow(win) {
        self._removeSidebar(win);
      },
    });

    // Inject into already-open windows
    for (const win of Services.wm.getEnumerator("mail:3pane")) {
      console.log("WooCommercePanel: found existing 3pane window, readyState:", win.document.readyState);
      if (win.document.readyState === "complete") {
        this._injectSidebar(win);
      }
    }
  }

  onShutdown(isAppShutdown) {
    if (isAppShutdown) return;
    console.log("WooCommercePanel: onShutdown called");

    const extensionId = "woocommerce-customer-lookup@thunderbird-extension";
    ExtensionSupport.unregisterWindowListener(extensionId);

    for (const win of Services.wm.getEnumerator("mail:3pane")) {
      this._removeSidebar(win);
    }
  }

  _injectSidebar(win) {
    const doc = win.document;
    console.log("WooCommercePanel: _injectSidebar called");

    // Already injected?
    if (doc.getElementById("woocommerce-sidebar")) {
      console.log("WooCommercePanel: sidebar already exists");
      return;
    }

    // In TB 128+/140+, the main content area in messenger.xhtml has this structure:
    // The today-pane-panel is the right sidebar for calendar/tasks.
    // We want to add our panel next to it or find the main content area.

    // Try multiple injection strategies
    let injectionPoint = null;
    let insertMethod = "after"; // "after", "before", "append"

    // Strategy 1: Find today-pane-panel and insert before it
    const todayPane = doc.getElementById("today-pane-panel");
    if (todayPane) {
      console.log("WooCommercePanel: found today-pane-panel");
      injectionPoint = todayPane;
      insertMethod = "before";
    }

    // Strategy 2: Find tabmail-container
    if (!injectionPoint) {
      const tabmailContainer = doc.getElementById("tabmail-container");
      if (tabmailContainer) {
        console.log("WooCommercePanel: found tabmail-container");
        injectionPoint = tabmailContainer;
        insertMethod = "after";
      }
    }

    // Strategy 3: Find any main layout container
    if (!injectionPoint) {
      const tabmail = doc.getElementById("tabmail");
      if (tabmail) {
        console.log("WooCommercePanel: found tabmail");
        injectionPoint = tabmail;
        insertMethod = "after";
      }
    }

    if (!injectionPoint) {
      // Log what we CAN find to help debug
      const allIds = [];
      const allElements = doc.querySelectorAll("[id]");
      allElements.forEach((el) => allIds.push(el.id));
      console.error(
        "WooCommercePanel: Could not find injection point. Available IDs:",
        allIds.slice(0, 50).join(", ")
      );
      return;
    }

    console.log("WooCommercePanel: injecting sidebar using strategy:", insertMethod, "relative to:", injectionPoint.id);

    // Create splitter
    const splitter = doc.createElement("div");
    splitter.id = "woocommerce-splitter";
    splitter.style.cssText = `
      width: 5px;
      cursor: ew-resize;
      background: var(--splitter-color, ThreeDShadow);
      flex-shrink: 0;
    `;

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
      justify-content: space-between;
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

    // Splitter drag behavior
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    splitter.addEventListener("mousedown", (e) => {
      isDragging = true;
      startX = e.clientX;
      startWidth = sidebar.offsetWidth;
      e.preventDefault();
    });

    doc.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const diff = startX - e.clientX;
      const newWidth = Math.min(500, Math.max(200, startWidth + diff));
      sidebar.style.width = newWidth + "px";
    });

    doc.addEventListener("mouseup", () => {
      isDragging = false;
    });

    // Insert into DOM
    const parent = injectionPoint.parentNode;
    if (insertMethod === "before") {
      parent.insertBefore(splitter, injectionPoint);
      parent.insertBefore(sidebar, injectionPoint);
    } else {
      // Insert after
      const ref = injectionPoint.nextSibling;
      parent.insertBefore(splitter, ref);
      parent.insertBefore(sidebar, ref);
    }

    this._panels.set(win, { sidebar, splitter, content, doc });
    console.log("WooCommercePanel: sidebar injected successfully");
  }

  _removeSidebar(win) {
    const panel = this._panels.get(win);
    if (!panel) return;

    panel.sidebar.remove();
    panel.splitter.remove();
    this._panels.delete(win);
    console.log("WooCommercePanel: sidebar removed");
  }

  getAPI(context) {
    const self = this;
    const { extension } = context;
    console.log("WooCommercePanel: getAPI called");

    return {
      WooCommercePanel: {
        async updatePanel(state) {
          console.log("WooCommercePanel: updatePanel called, state:", state.type);
          for (const [win, panel] of self._panels) {
            _updatePanelContent(panel, state);
          }
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

      // Total value
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

      // Orders list
      for (const order of state.orders) {
        const card = doc.createElement("div");
        card.style.cssText = `
          padding: 6px 0;
          border-bottom: 1px solid var(--splitter-color, #ddd);
        `;

        // Top row: order number link + total
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
            const topWin = content.ownerGlobal.top || content.ownerGlobal;
            if (topWin.openLinkExternally) {
              topWin.openLinkExternally(link.href);
            } else {
              const eps = Cc[
                "@mozilla.org/uriloader/external-protocol-service;1"
              ].getService(Ci.nsIExternalProtocolService);
              eps.loadURI(Services.io.newURI(link.href));
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

        // Bottom row: date + status badge
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
