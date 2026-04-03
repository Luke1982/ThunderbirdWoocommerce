# Thunderbird WooCommerce Plugin — Design Spec

## Overview

A Thunderbird MailExtension (with Experiment API) that connects to a WooCommerce shop. When a user views an email, the plugin looks up the sender's email address in WooCommerce and displays their order history in a collapsible panel below the message headers.

## Target Platform

- Thunderbird 128+ (modern MailExtension / WebExtension-based, manifest_version 2)
- WooCommerce REST API v3

## Extension Metadata

- **Name**: WooCommerce Customer Lookup
- **ID**: `woocommerce-customer-lookup@thunderbird-extension`
- **Version**: 1.0.0
- **Minimum Thunderbird version**: 128.0

## Authentication

- WooCommerce Consumer Key + Consumer Secret (generated in WooCommerce admin under Settings > Advanced > REST API)
- Credentials stored locally via `browser.storage.local` (not encrypted at rest — security relies on OS-level file permissions for the Thunderbird profile directory)
- Transmitted as HTTP Basic Auth over HTTPS

## Manifest Structure

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
  "permissions": ["storage", "messagesRead"],
  "background": {
    "scripts": ["background.js"]
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

## Extension Structure

```
thunderbird-woocommerce/
  manifest.json
  background.js
  options/
    options.html
    options.js
    options.css
  api/
    WooCommercePanel/
      schema.json          # Experiment API schema (defines functions + events)
      implementation.js    # Child process script running in about:message context
  _locales/
    en/
      messages.json
    nl/
      messages.json
```

## Components

### 1. Experiment API (`api/WooCommercePanel/`)

A custom Thunderbird Experiment API that runs as a **child** implementation in the `about:message` context, giving it direct DOM access to the message display pane.

**Panel injection:** The implementation inserts a `<div>` element after the `expandedHeadersTopBox` element in the `about:message` document. This places the panel directly below the message headers and above the message body. The panel's HTML and CSS are constructed inline in `implementation.js` (no separate panel.html/css/js files needed since the child script has direct DOM access).

**Multi-tab/multi-window support:** Since the child implementation runs in each `about:message` context independently, each message tab/window gets its own panel instance. The background script communicates with panels via `browser.runtime.sendMessage()` and `browser.runtime.onMessage`, using a `tabId` parameter to target the correct panel. Each child instance registers with the background on load and provides its tab identity.

**API surface defined in `schema.json`:**

Events:
- `onMessageDisplayed(tabId, senderEmail)` — fired when a message is displayed, provides tab ID and sender email

Functions:
- `updatePanel(tabId, state)` — updates the panel in the specified tab. `state` is an object with a `type` field:
  - `{ type: "loading" }` — show loading spinner
  - `{ type: "not_configured" }` — show "not configured" message
  - `{ type: "customer_not_found" }` — show "not a customer" message
  - `{ type: "no_orders" }` — show "no orders yet" message
  - `{ type: "error", message: string }` — show error message
  - `{ type: "orders", totalValue: string, currency: string, orders: Order[] }` — show order list

**Message display detection:** The child script listens for message load events in the `about:message` context (via a `DOMContentLoaded` listener or by observing the message URI change) and extracts the sender email from the displayed message headers using `gMessage` or `gDBView` internal APIs.

### 2. Background Script (`background.js`)

Orchestrates the flow:

1. Listens for `WooCommercePanel.onMessageDisplayed` event (receives tabId and sender email)
2. Calls `WooCommercePanel.updatePanel(tabId, { type: "loading" })`
3. Reads shop URL and credentials from `browser.storage.local`
4. If not configured, calls `updatePanel` with `not_configured` state
5. Queries WooCommerce REST API for customer by email
6. If no customer found, also queries orders by email to catch guest orders
7. If neither registered customer nor guest orders found, shows `customer_not_found`
8. If customer/orders found, calculates total and shows `orders` state

### 3. Options Page (`options/`)

Standard extension preferences page accessible from Thunderbird's Add-ons Manager:

- **Shop URL** — text input, the WooCommerce shop base URL (e.g., `https://myshop.example.com`)
- **Consumer Key** — text input for the WooCommerce REST API consumer key
- **Consumer Secret** — password input for the consumer secret
- **Save button** — stores values to `browser.storage.local`
- **Test Connection button** — verifies credentials by calling `GET /wp-json/wc/v3/system_status` (requires read access)

### 4. WooCommerce API Client (in `background.js`)

Communicates with the WooCommerce REST API v3:

- `GET /wp-json/wc/v3/customers?email={email}` — look up registered customer by email
- `GET /wp-json/wc/v3/orders?customer={customer_id}&per_page=100&orderby=date&order=desc` — fetch orders for a registered customer
- `GET /wp-json/wc/v3/orders?search={email}&per_page=100&orderby=date&order=desc` — fallback to find guest orders by email
- Uses `fetch()` with Basic Auth header (`Base64(consumer_key:consumer_secret)`)
- Handles pagination if customer has more than 100 orders (follows `X-WP-TotalPages` header)
- Simple in-memory cache keyed by email address with 5-minute TTL to avoid redundant API calls when switching between messages from the same sender

### 5. i18n (`_locales/`)

Translations for English (en) and Dutch (nl). All user-facing strings use `browser.i18n.getMessage()` or `__MSG_key__` substitution in HTML.

Key translation strings:
- `extensionName` — "WooCommerce Customer Lookup"
- `extensionDescription` — "Look up WooCommerce customers and orders from email"
- `panelTitle` — "WooCommerce"
- `loading` — "Loading..."
- `customerNotFound` — "Not a WooCommerce customer"
- `noOrders` — "Customer has no orders yet"
- `totalOrderValue` — "Total order value"
- `orderNumber` — "Order"
- `orderDate` — "Date"
- `orderStatus` — "Status"
- `orderTotal` — "Total"
- `notConfigured` — "WooCommerce not configured. Go to Add-on Settings."
- `errorFetching` — "Error fetching WooCommerce data"
- `authError` — "Authentication failed — check your API credentials"
- `settingsTitle` — "WooCommerce Settings"
- `shopUrl` — "Shop URL"
- `consumerKey` — "Consumer Key"
- `consumerSecret` — "Consumer Secret"
- `save` — "Save"
- `testConnection` — "Test Connection"
- `connectionSuccess` — "Connection successful"
- `connectionFailed` — "Connection failed"

## Data Flow

1. User opens/selects an email in Thunderbird
2. Experiment API child script (running in `about:message`) detects message display
3. Child script extracts sender email from message headers
4. Child script fires `onMessageDisplayed(tabId, senderEmail)` to background script
5. Background script calls `updatePanel(tabId, { type: "loading" })`
6. Background script checks in-memory cache for this email — if cache hit and not expired, uses cached data
7. Background script reads credentials from `browser.storage.local`
8. If no credentials configured → `updatePanel` with `not_configured` → stop
9. Background script calls `GET /wc/v3/customers?email={email}`
10. If API error → `updatePanel` with `error` → stop
11. If customer found → call `GET /wc/v3/orders?customer={id}&per_page=100&orderby=date&order=desc`
12. If no customer found → fallback: call `GET /wc/v3/orders?search={email}&per_page=100&orderby=date&order=desc` (guest orders)
13. If no orders from either path → `updatePanel` with `no_orders` or `customer_not_found` as appropriate
14. Background script calculates total order value (sum of all order totals, in shop's default currency)
15. Cache result keyed by email with 5-minute TTL
16. `updatePanel(tabId, { type: "orders", totalValue, currency, orders })` — panel displays data

## Panel UI

A collapsible bar inserted after `expandedHeadersTopBox` in the `about:message` document:

- **Default state**: Expanded (not persisted across sessions for simplicity)
- **Collapsed state**: Single bar with "WooCommerce" label and expand/collapse toggle
- **Expanded state**:
  - Loading: spinner with "Loading..." text
  - Error/info states: centered message text
  - Orders view:
    - Total order value displayed prominently at top
    - Scrollable list of orders, each row showing:
      - Order number as clickable link (uses HPOS URL: `{shop_url}/wp-admin/admin.php?page=wc-orders&action=edit&id={order_id}`, opens in default browser)
      - Date (formatted via `Intl.DateTimeFormat` using the extension's locale)
      - Status with color-coded badge:
        - Green: `completed`
        - Blue: `processing`
        - Orange: `on-hold`, `pending`
        - Red: `refunded`, `cancelled`, `failed`
        - Gray: any unknown/custom status
      - Order total amount (formatted via `Intl.NumberFormat` using currency from the order's `currency` field)
- Styled to match Thunderbird's native UI (uses system colors, fonts)
- Max height of 300px with overflow scroll for long order lists

## Currency Handling

- Each order's total is displayed using that order's own `currency` field and formatted via `Intl.NumberFormat`
- The "total order value" sums only orders sharing the same currency as the most recent order; if mixed currencies exist, show the sum for the dominant currency with a note "(mixed currencies)"
- Currency symbol comes from `Intl.NumberFormat`, not the WooCommerce `currency_symbol` field, for locale-appropriate display

## Error Handling

- **No credentials configured** → panel shows translated message with pointer to settings
- **Network errors** → panel shows "Error fetching WooCommerce data" with details
- **Authentication errors (401/403)** → panel shows "Authentication failed — check your API credentials"
- **API rate limiting (429)** → retry once after 2 seconds, then show error
- **Invalid shop URL** → caught during fetch, shown as connection error
- **Malformed API responses** → caught with try/catch, shown as generic error

## Security Considerations

- Consumer key/secret stored in `browser.storage.local` (not encrypted — relies on OS-level profile directory permissions)
- Credentials only sent over HTTPS (warn user if shop URL is HTTP)
- No credentials logged or exposed in panel UI
- API requests scoped to read-only operations (customers and orders)

## Permissions

In `manifest.json`:
- `storage` — for saving credentials
- `messagesRead` — for accessing message headers (sender email)

The Experiment API child script provides the additional capability to modify the message display pane DOM.
