# Thunderbird WooCommerce Plugin — Design Spec

## Overview

A Thunderbird MailExtension (with Experiment API) that connects to a WooCommerce shop. When a user views an email, the plugin looks up the sender's email address in WooCommerce and displays their order history in a collapsible panel below the message headers.

## Target Platform

- Thunderbird 128+ (modern MailExtension / WebExtension-based)
- WooCommerce REST API v3

## Authentication

- WooCommerce Consumer Key + Consumer Secret (generated in WooCommerce admin under Settings > Advanced > REST API)
- Credentials stored locally via `browser.storage.local`
- Transmitted as HTTP Basic Auth over HTTPS

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
      schema.json          # Experiment API schema
      implementation.js    # Experiment API implementation
      panel.html           # Injected panel markup
      panel.css            # Panel styling
      panel.js             # Panel client-side logic
  _locales/
    en/
      messages.json
    nl/
      messages.json
```

## Components

### 1. Experiment API (`api/WooCommercePanel/`)

A custom Thunderbird Experiment API that:

- Injects a collapsible panel below the message headers in the message display pane
- Detects when a message is displayed and extracts the sender's email from the headers
- Provides methods for the background script to send data to the panel:
  - `setLoading()` — show a loading spinner
  - `setCustomerNotFound()` — show "Not a WooCommerce customer" message
  - `setNoOrders()` — show "Customer has no orders yet" message
  - `setOrders(totalValue, orders)` — show order list with total value
  - `setError(message)` — show error message
  - `setNotConfigured()` — show message directing user to settings

The experiment API listens for message display events via Thunderbird's internal APIs (e.g., `gMessageListeners` or similar message display observer) and fires an event that the background script subscribes to.

### 2. Background Script (`background.js`)

Orchestrates the flow:

1. Listens for `onMessageDisplayed` event from the experiment API (receives sender email)
2. Reads shop URL and credentials from `browser.storage.local`
3. If not configured, tells panel to show "not configured" state
4. Queries WooCommerce REST API for customer by email
5. If no customer found, tells panel to show "not a customer" state
6. If customer found, queries orders for that customer
7. Calculates total order value across all orders
8. Sends order data to the panel

### 3. Options Page (`options/`)

Standard extension preferences page accessible from Thunderbird's Add-ons Manager:

- **Shop URL** — text input, the WooCommerce shop base URL (e.g., `https://myshop.example.com`)
- **Consumer Key** — text input for the WooCommerce REST API consumer key
- **Consumer Secret** — password input for the consumer secret
- **Save button** — stores values to `browser.storage.local`
- **Test Connection button** — verifies credentials by calling a simple WooCommerce endpoint

### 4. WooCommerce API Client (in `background.js`)

Communicates with the WooCommerce REST API v3:

- `GET /wp-json/wc/v3/customers?email={email}` — look up customer by email address
- `GET /wp-json/wc/v3/orders?customer={customer_id}&per_page=100&orderby=date&order=desc` — fetch orders for a customer
- Uses `fetch()` with Basic Auth header (`Base64(consumer_key:consumer_secret)`)
- Handles pagination if customer has more than 100 orders (follows `X-WP-TotalPages` header)

### 5. i18n (`_locales/`)

Translations for English (en) and Dutch (nl). All user-facing strings use `browser.i18n.getMessage()` or `__MSG_key__` substitution in HTML.

Key translation strings:
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
2. Experiment API detects message display, extracts sender email from message headers
3. Experiment API fires event to background script with the sender email
4. Background script sets panel to loading state
5. Background script reads credentials from storage
6. If no credentials configured → panel shows "not configured" message → stop
7. Background script calls `GET /wc/v3/customers?email={email}`
8. If API error → panel shows error message → stop
9. If no customer found (empty result) → panel shows "Not a WooCommerce customer" → stop
10. Background script calls `GET /wc/v3/orders?customer={id}&per_page=100&orderby=date&order=desc`
11. If no orders → panel shows "Customer has no orders yet" → stop
12. Background script calculates total order value (sum of all order totals)
13. Panel displays: total customer order value, then a scrollable list of orders

## Panel UI

A collapsible bar inserted below the message headers:

- **Collapsed state**: Single bar with "WooCommerce" label and expand/collapse toggle
- **Expanded state**:
  - Loading: spinner with "Loading..." text
  - Error/info states: centered message text
  - Orders view:
    - Total order value displayed prominently at top
    - Scrollable list of orders, each row showing:
      - Order number as clickable link (opens `{shop_url}/wp-admin/post.php?post={order_id}&action=edit` in default browser)
      - Date (formatted per locale)
      - Status (with color-coded badge: green=completed, orange=processing, red=refunded, etc.)
      - Order total amount (with currency)
- Styled to match Thunderbird's native UI (uses system colors, fonts)
- Max height with scroll for long order lists

## Error Handling

- **No credentials configured** → panel shows translated message with pointer to settings
- **Network errors** → panel shows "Error fetching WooCommerce data" with details
- **Authentication errors (401/403)** → panel shows "Authentication failed — check your API credentials"
- **API rate limiting (429)** → retry once after 2 seconds, then show error
- **Invalid shop URL** → caught during fetch, shown as connection error
- **Malformed API responses** → caught with try/catch, shown as generic error

## Security Considerations

- Consumer key/secret stored in `browser.storage.local` (encrypted at rest by Thunderbird's storage)
- Credentials only sent over HTTPS (warn user if shop URL is HTTP)
- No credentials logged or exposed in panel UI
- API requests scoped to read-only operations (customers and orders)

## Permissions

In `manifest.json`:
- `storage` — for saving credentials
- `messagesRead` — for accessing message headers (sender email)

The Experiment API provides the additional capability to modify the message display pane.
