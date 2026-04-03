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
      if (key === "_retry") continue; // internal param, don't send to API
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
      if (params._retry) {
        throw new Error("Rate limited by WooCommerce API");
      }
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
