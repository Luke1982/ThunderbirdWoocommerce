# Thunderbird WooCommerce Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Thunderbird MailExtension with Experiment API that shows WooCommerce customer orders in a panel below message headers.

**Architecture:** MailExtension (manifest v2) with a child Experiment API running in `about:message` context for DOM injection. Background script handles WooCommerce REST API calls and caching. Options page for credential configuration.

**Tech Stack:** Thunderbird MailExtension APIs, Experiment API (child context), WooCommerce REST API v3, browser.storage.local, Intl APIs for formatting.

**Spec:** `docs/superpowers/specs/2026-04-03-thunderbird-woocommerce-plugin-design.md`

---

## File Structure

```
thunderbird-woocommerce/
  manifest.json                          # Extension manifest with experiment_apis registration
  background.js                          # Orchestration: listens for events, calls WooCommerce API, updates panel
  woocommerce-api.js                     # WooCommerce REST API client with caching
  options/
    options.html                         # Settings form UI
    options.js                           # Settings form logic (save/load/test)
    options.css                          # Settings form styling
  api/
    WooCommercePanel/
      schema.json                        # Experiment API schema (events + functions)
      implementation.js                  # Child script: DOM injection, panel rendering, message detection
  _locales/
    en/
      messages.json                      # English translations
    nl/
      messages.json                      # Dutch translations
```

Note: `woocommerce-api.js` is split from `background.js` to keep the API client (fetch, auth, caching, pagination) separate from the orchestration logic. Both are loaded as background scripts in the manifest.

---

### Task 1: Project Scaffolding — manifest.json and i18n

**Files:**
- Create: `manifest.json`
- Create: `_locales/en/messages.json`
- Create: `_locales/nl/messages.json`

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 2,
  "name": "__MSG_extensionName__",
  "version": "1.0.0",
  "description": "__MSG_extensionDescription__",
  "default_locale": "en",
  "browser_specific_settings": {
    "gecko": {
      "id": "woocommerce-customer-lookup@thunderbird-extension",
      "strict_min_version": "128.0"
    }
  },
  "permissions": [
    "storage",
    "messagesRead"
  ],
  "background": {
    "scripts": [
      "woocommerce-api.js",
      "background.js"
    ]
  },
  "options_ui": {
    "page": "options/options.html"
  },
  "experiment_apis": {
    "WooCommercePanel": {
      "schema": "api/WooCommercePanel/schema.json",
      "child": {
        "scopes": ["addon_child"],
        "script": "api/WooCommercePanel/implementation.js",
        "paths": [["WooCommercePanel"]]
      }
    }
  }
}
```

- [ ] **Step 2: Create English locale**

Create `_locales/en/messages.json`:

```json
{
  "extensionName": {
    "message": "WooCommerce Customer Lookup"
  },
  "extensionDescription": {
    "message": "Look up WooCommerce customers and orders from email"
  },
  "panelTitle": {
    "message": "WooCommerce Orders"
  },
  "loading": {
    "message": "Loading..."
  },
  "customerNotFound": {
    "message": "Not a WooCommerce customer"
  },
  "noOrders": {
    "message": "Customer has no orders yet"
  },
  "totalOrderValue": {
    "message": "Total order value"
  },
  "mixedCurrencies": {
    "message": "(mixed currencies)"
  },
  "orderNumber": {
    "message": "Order #$ORDER_ID$",
    "placeholders": {
      "ORDER_ID": {
        "content": "$1"
      }
    }
  },
  "notConfigured": {
    "message": "WooCommerce not configured. Go to Add-on Settings."
  },
  "errorFetching": {
    "message": "Error fetching WooCommerce data"
  },
  "authError": {
    "message": "Authentication failed — check your API credentials"
  },
  "settingsTitle": {
    "message": "WooCommerce Settings"
  },
  "shopUrl": {
    "message": "Shop URL"
  },
  "shopUrlPlaceholder": {
    "message": "https://myshop.example.com"
  },
  "consumerKey": {
    "message": "Consumer Key"
  },
  "consumerSecret": {
    "message": "Consumer Secret"
  },
  "save": {
    "message": "Save"
  },
  "saved": {
    "message": "Settings saved"
  },
  "testConnection": {
    "message": "Test Connection"
  },
  "connectionSuccess": {
    "message": "Connection successful!"
  },
  "connectionFailed": {
    "message": "Connection failed: $ERROR$",
    "placeholders": {
      "ERROR": {
        "content": "$1"
      }
    }
  },
  "httpsWarning": {
    "message": "Warning: Shop URL does not use HTTPS. Credentials will be sent insecurely."
  },
  "statusCompleted": {
    "message": "Completed"
  },
  "statusProcessing": {
    "message": "Processing"
  },
  "statusOnHold": {
    "message": "On hold"
  },
  "statusPending": {
    "message": "Pending"
  },
  "statusRefunded": {
    "message": "Refunded"
  },
  "statusCancelled": {
    "message": "Cancelled"
  },
  "statusFailed": {
    "message": "Failed"
  }
}
```

- [ ] **Step 3: Create Dutch locale**

Create `_locales/nl/messages.json`:

```json
{
  "extensionName": {
    "message": "WooCommerce Klanten Opzoeken"
  },
  "extensionDescription": {
    "message": "Zoek WooCommerce klanten en bestellingen op via e-mail"
  },
  "panelTitle": {
    "message": "WooCommerce Bestellingen"
  },
  "loading": {
    "message": "Laden..."
  },
  "customerNotFound": {
    "message": "Geen WooCommerce klant"
  },
  "noOrders": {
    "message": "Klant heeft nog geen bestellingen"
  },
  "totalOrderValue": {
    "message": "Totale bestelwaarde"
  },
  "mixedCurrencies": {
    "message": "(gemengde valuta)"
  },
  "orderNumber": {
    "message": "Bestelling #$ORDER_ID$",
    "placeholders": {
      "ORDER_ID": {
        "content": "$1"
      }
    }
  },
  "notConfigured": {
    "message": "WooCommerce niet geconfigureerd. Ga naar Add-on Instellingen."
  },
  "errorFetching": {
    "message": "Fout bij ophalen WooCommerce gegevens"
  },
  "authError": {
    "message": "Authenticatie mislukt — controleer uw API-inloggegevens"
  },
  "settingsTitle": {
    "message": "WooCommerce Instellingen"
  },
  "shopUrl": {
    "message": "Winkel URL"
  },
  "shopUrlPlaceholder": {
    "message": "https://mijnwinkel.voorbeeld.nl"
  },
  "consumerKey": {
    "message": "Consumer Key"
  },
  "consumerSecret": {
    "message": "Consumer Secret"
  },
  "save": {
    "message": "Opslaan"
  },
  "saved": {
    "message": "Instellingen opgeslagen"
  },
  "testConnection": {
    "message": "Verbinding Testen"
  },
  "connectionSuccess": {
    "message": "Verbinding geslaagd!"
  },
  "connectionFailed": {
    "message": "Verbinding mislukt: $ERROR$",
    "placeholders": {
      "ERROR": {
        "content": "$1"
      }
    }
  },
  "httpsWarning": {
    "message": "Waarschuwing: Winkel URL gebruikt geen HTTPS. Inloggegevens worden onveilig verzonden."
  },
  "statusCompleted": {
    "message": "Voltooid"
  },
  "statusProcessing": {
    "message": "In behandeling"
  },
  "statusOnHold": {
    "message": "In de wacht"
  },
  "statusPending": {
    "message": "In afwachting"
  },
  "statusRefunded": {
    "message": "Terugbetaald"
  },
  "statusCancelled": {
    "message": "Geannuleerd"
  },
  "statusFailed": {
    "message": "Mislukt"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add manifest.json _locales/
git commit -m "feat: add manifest.json and i18n locales (en, nl)"
```

---

### Task 2: WooCommerce API Client

**Files:**
- Create: `woocommerce-api.js`

- [ ] **Step 1: Create `woocommerce-api.js`**

This file provides the `WooCommerceClient` class used by `background.js`. It handles auth, fetching, pagination, and caching.

```javascript
/**
 * WooCommerce REST API client for Thunderbird extension.
 * Loaded as a background script before background.js.
 */

class WooCommerceClient {
  constructor() {
    this._cache = new Map();
    this._cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Load credentials from storage.
   * Returns { shopUrl, consumerKey, consumerSecret } or null if not configured.
   */
  async getConfig() {
    const data = await browser.storage.local.get([
      "shopUrl",
      "consumerKey",
      "consumerSecret",
    ]);
    if (!data.shopUrl || !data.consumerKey || !data.consumerSecret) {
      return null;
    }
    return {
      shopUrl: data.shopUrl.replace(/\/+$/, ""),
      consumerKey: data.consumerKey,
      consumerSecret: data.consumerSecret,
    };
  }

  /**
   * Make an authenticated GET request to the WooCommerce REST API.
   * @param {object} config - { shopUrl, consumerKey, consumerSecret }
   * @param {string} endpoint - e.g. "/wc/v3/customers"
   * @param {object} params - query parameters
   * @returns {{ data: any, totalPages: number }}
   */
  async apiGet(config, endpoint, params = {}) {
    const url = new URL(`${config.shopUrl}/wp-json${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const credentials = btoa(
      `${config.consumerKey}:${config.consumerSecret}`
    );

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json",
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("auth_error");
    }

    if (response.status === 429) {
      // Retry once after 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return this.apiGet(config, endpoint, { ...params, _retry: 1 });
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const totalPages = parseInt(
      response.headers.get("X-WP-TotalPages") || "1",
      10
    );

    return { data, totalPages };
  }

  /**
   * Fetch all pages for a paginated endpoint.
   */
  async apiGetAllPages(config, endpoint, params = {}) {
    const firstPage = await this.apiGet(config, endpoint, {
      ...params,
      per_page: 100,
      page: 1,
    });

    let allData = firstPage.data;

    for (let page = 2; page <= firstPage.totalPages; page++) {
      const nextPage = await this.apiGet(config, endpoint, {
        ...params,
        per_page: 100,
        page,
      });
      allData = allData.concat(nextPage.data);
    }

    return allData;
  }

  /**
   * Look up a customer by email.
   * @returns {object|null} Customer object or null if not found.
   */
  async findCustomer(config, email) {
    const result = await this.apiGet(config, "/wc/v3/customers", {
      email,
    });
    if (result.data && result.data.length > 0) {
      return result.data[0];
    }
    return null;
  }

  /**
   * Fetch orders for a registered customer by ID.
   */
  async getOrdersByCustomerId(config, customerId) {
    return this.apiGetAllPages(config, "/wc/v3/orders", {
      customer: customerId,
      orderby: "date",
      order: "desc",
    });
  }

  /**
   * Fetch guest orders by email address search.
   */
  async getOrdersByEmail(config, email) {
    const orders = await this.apiGetAllPages(config, "/wc/v3/orders", {
      search: email,
      orderby: "date",
      order: "desc",
    });
    // Filter to only orders matching this exact email (search can be fuzzy)
    return orders.filter(
      (o) => o.billing && o.billing.email.toLowerCase() === email.toLowerCase()
    );
  }

  /**
   * Main lookup: find customer + orders by email.
   * Returns cached result if available and fresh.
   * @returns {{ totalValue: string, currency: string, mixedCurrencies: boolean, orders: Array }}
   *   or { type: "not_configured" | "customer_not_found" | "no_orders" }
   *   or throws on error
   */
  async lookupByEmail(email) {
    const normalizedEmail = email.toLowerCase().trim();

    // Check cache
    const cached = this._cache.get(normalizedEmail);
    if (cached && Date.now() - cached.timestamp < this._cacheTTL) {
      return cached.result;
    }

    const config = await this.getConfig();
    if (!config) {
      return { type: "not_configured" };
    }

    // Try registered customer first
    const customer = await this.findCustomer(config, normalizedEmail);
    let orders = [];

    if (customer) {
      orders = await this.getOrdersByCustomerId(config, customer.id);
    }

    // If no registered customer or no orders, try guest orders
    if (orders.length === 0) {
      orders = await this.getOrdersByEmail(config, normalizedEmail);
    }

    if (!customer && orders.length === 0) {
      const result = { type: "customer_not_found" };
      this._cache.set(normalizedEmail, { result, timestamp: Date.now() });
      return result;
    }

    if (orders.length === 0) {
      const result = { type: "no_orders" };
      this._cache.set(normalizedEmail, { result, timestamp: Date.now() });
      return result;
    }

    // Calculate total order value
    // Group by currency, sum the dominant one
    const currencyTotals = {};
    for (const order of orders) {
      const cur = order.currency || "USD";
      const amount = parseFloat(order.total) || 0;
      currencyTotals[cur] = (currencyTotals[cur] || 0) + amount;
    }

    const currencies = Object.keys(currencyTotals);
    // Pick currency with highest total as dominant
    let dominantCurrency = currencies[0];
    for (const cur of currencies) {
      if (currencyTotals[cur] > currencyTotals[dominantCurrency]) {
        dominantCurrency = cur;
      }
    }

    const result = {
      type: "orders",
      totalValue: currencyTotals[dominantCurrency].toFixed(2),
      currency: dominantCurrency,
      mixedCurrencies: currencies.length > 1,
      orders: orders.map((o) => ({
        id: o.id,
        number: o.number,
        date: o.date_created,
        status: o.status,
        total: o.total,
        currency: o.currency || dominantCurrency,
      })),
    };

    this._cache.set(normalizedEmail, { result, timestamp: Date.now() });
    return result;
  }

  /**
   * Test connection to WooCommerce.
   * @returns {true} on success, throws on failure.
   */
  async testConnection(shopUrl, consumerKey, consumerSecret) {
    const config = {
      shopUrl: shopUrl.replace(/\/+$/, ""),
      consumerKey,
      consumerSecret,
    };
    await this.apiGet(config, "/wc/v3/system_status");
    return true;
  }
}

// Global instance available to background.js
var wooCommerce = new WooCommerceClient();
```

- [ ] **Step 2: Commit**

```bash
git add woocommerce-api.js
git commit -m "feat: add WooCommerce REST API client with caching"
```

---

### Task 3: Experiment API Schema

**Files:**
- Create: `api/WooCommercePanel/schema.json`

- [ ] **Step 1: Create `api/WooCommercePanel/schema.json`**

This defines the API surface that the background script can call and listen to.

```json
[
  {
    "namespace": "WooCommercePanel",
    "types": [
      {
        "id": "PanelState",
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "loading",
              "not_configured",
              "customer_not_found",
              "no_orders",
              "error",
              "orders"
            ]
          },
          "message": {
            "type": "string",
            "optional": true
          },
          "totalValue": {
            "type": "string",
            "optional": true
          },
          "currency": {
            "type": "string",
            "optional": true
          },
          "mixedCurrencies": {
            "type": "boolean",
            "optional": true
          },
          "shopUrl": {
            "type": "string",
            "optional": true
          },
          "orders": {
            "type": "array",
            "optional": true,
            "items": {
              "type": "object",
              "properties": {
                "id": { "type": "integer" },
                "number": { "type": "string" },
                "date": { "type": "string" },
                "status": { "type": "string" },
                "total": { "type": "string" },
                "currency": { "type": "string" }
              }
            }
          }
        }
      }
    ],
    "events": [
      {
        "name": "onMessageDisplayed",
        "type": "function",
        "parameters": [
          {
            "name": "tabId",
            "type": "integer"
          },
          {
            "name": "senderEmail",
            "type": "string"
          }
        ]
      }
    ],
    "functions": [
      {
        "name": "updatePanel",
        "type": "function",
        "async": true,
        "parameters": [
          {
            "name": "tabId",
            "type": "integer"
          },
          {
            "name": "state",
            "$ref": "PanelState"
          }
        ]
      }
    ]
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add api/WooCommercePanel/schema.json
git commit -m "feat: add Experiment API schema for WooCommercePanel"
```

---

### Task 4: Experiment API Implementation (Child Script)

**Files:**
- Create: `api/WooCommercePanel/implementation.js`

This is the most complex file. It runs in the `about:message` context, injects the panel DOM, detects message display, and handles `updatePanel` calls.

- [ ] **Step 1: Create `api/WooCommercePanel/implementation.js`**

```javascript
"use strict";

/* global ExtensionCommon, ExtensionAPI */

var WooCommercePanel = class extends ExtensionAPI {
  /**
   * Called when the API is first used. Sets up the panel and message listeners.
   */
  getAPI(context) {
    const { extension } = context;

    // Track panels per tab and event listeners
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

                  // Get the tab ID from the window context
                  const tabId = context.viewType === "tab"
                    ? context.tabId
                    : win.browsingContext?.id || 0;

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
          const uri = Cc[
            "@mozilla.org/network/io-service;1"
          ]
            .getService(Ci.nsIIOService)
            .newURI(link.href);
          const externalProtocolService = Cc[
            "@mozilla.org/uriloader/external-protocol-service;1"
          ]
            .getService(Ci.nsIExternalProtocolService);
          externalProtocolService.loadURI(uri);
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
```

- [ ] **Step 2: Commit**

```bash
git add api/WooCommercePanel/
git commit -m "feat: add Experiment API implementation for panel injection"
```

---

### Task 5: Background Script

**Files:**
- Create: `background.js`

- [ ] **Step 1: Create `background.js`**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add background.js
git commit -m "feat: add background script for WooCommerce lookup orchestration"
```

---

### Task 6: Options Page

**Files:**
- Create: `options/options.html`
- Create: `options/options.js`
- Create: `options/options.css`

- [ ] **Step 1: Create `options/options.html`**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="options.css" />
  </head>
  <body>
    <h1 data-i18n="settingsTitle"></h1>

    <form id="settings-form">
      <div class="field">
        <label for="shopUrl" data-i18n="shopUrl"></label>
        <input
          type="url"
          id="shopUrl"
          data-i18n-placeholder="shopUrlPlaceholder"
          required
        />
        <div id="https-warning" class="warning" hidden data-i18n="httpsWarning"></div>
      </div>

      <div class="field">
        <label for="consumerKey" data-i18n="consumerKey"></label>
        <input type="text" id="consumerKey" required />
      </div>

      <div class="field">
        <label for="consumerSecret" data-i18n="consumerSecret"></label>
        <input type="password" id="consumerSecret" required />
      </div>

      <div class="buttons">
        <button type="submit" id="save-btn" data-i18n="save"></button>
        <button type="button" id="test-btn" data-i18n="testConnection"></button>
      </div>

      <div id="status-message" hidden></div>
    </form>

    <script src="options.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `options/options.css`**

```css
body {
  font-family: -moz-default, sans-serif;
  font-size: 14px;
  padding: 16px;
  max-width: 500px;
  color: -moz-DialogText;
  background: -moz-Dialog;
}

h1 {
  font-size: 18px;
  margin-bottom: 16px;
}

.field {
  margin-bottom: 12px;
}

label {
  display: block;
  margin-bottom: 4px;
  font-weight: bold;
}

input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid ThreeDShadow;
  border-radius: 3px;
  font-size: 13px;
  box-sizing: border-box;
}

.buttons {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

button {
  padding: 6px 16px;
  border: 1px solid ThreeDShadow;
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
}

#status-message {
  margin-top: 12px;
  padding: 8px;
  border-radius: 3px;
  font-size: 13px;
}

#status-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

#status-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.warning {
  margin-top: 4px;
  color: #856404;
  font-size: 12px;
}
```

- [ ] **Step 3: Create `options/options.js`**

```javascript
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
```

- [ ] **Step 4: Commit**

```bash
git add options/
git commit -m "feat: add options page for WooCommerce credentials"
```

---

### Task 7: Manual Integration Testing

No automated tests for this extension (Thunderbird extensions can't be unit tested outside of Thunderbird). Instead, verify manually.

- [ ] **Step 1: Load extension in Thunderbird**

1. Open Thunderbird
2. Go to Add-ons Manager (Tools > Add-ons and Themes)
3. Click the gear icon > "Debug Add-ons"
4. Click "Load Temporary Add-on..."
5. Navigate to the project directory and select `manifest.json`

Expected: Extension loads without errors in the console.

- [ ] **Step 2: Configure settings**

1. Go to Add-ons Manager
2. Find "WooCommerce Customer Lookup" and click "Preferences"
3. Enter shop URL, consumer key, consumer secret
4. Click "Test Connection"

Expected: "Connection successful!" message.

- [ ] **Step 3: Test with a known customer email**

1. Open an email from a known WooCommerce customer
2. Check that the WooCommerce panel appears below the headers
3. Verify it shows total order value and order list
4. Click an order link — verify it opens in the browser

Expected: Panel shows orders with correct data, links open in browser.

- [ ] **Step 4: Test with unknown email**

Open an email from someone who is not a WooCommerce customer.

Expected: Panel shows "Not a WooCommerce customer".

- [ ] **Step 5: Test error states**

1. Enter wrong API credentials and view an email → should show auth error
2. Remove all credentials and view an email → should show "not configured"

- [ ] **Step 6: Verify Dutch translations**

If Thunderbird is set to Dutch locale, verify all strings appear in Dutch.

- [ ] **Step 7: Commit any fixes and tag release**

```bash
git tag v1.0.0
```
