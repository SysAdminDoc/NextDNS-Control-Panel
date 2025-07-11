# NextDNS Ultimate Control Panel

A browser extension that supercharges the NextDNS web interface with a powerful floating control panel for advanced filtering, bulk actions, and streamlined domain management.

-----

## Introduction

The NextDNS Ultimate Control Panel is a browser extension designed to enhance the user experience on the `my.nextdns.io` website. It injects a feature-rich, draggable control panel directly into the NextDNS logs and settings pages. This panel provides users with quick access to advanced log filtering, one-click domain actions (allow, deny, hide), data export utilities, and appearance customizations—all without leaving the current page. The core philosophy is to bring powerful management capabilities to your fingertips, reducing clicks and integrating seamlessly with the NextDNS API for a more efficient workflow.

-----

## Features

### 1\. Floating Control Panel

  * **What it does:** Provides a persistent, draggable, and collapsible panel that offers centralized access to all extension features. It can be positioned on either side of the screen and locked in place.
  * **How it improves the target interface:** Eliminates the need to navigate through different menus. All major functions are available in a single, consolidated UI that hovers over the main content.
  * **Example usage or code snippet:**
    ```javascript
    // from script.js

    async function createPanel() {
        if (document.getElementById('ndns-panel-main')) return;
        panel = document.createElement('div');
        panel.id = 'ndns-panel-main';
        panel.className = 'ndns-panel';

        // ... panel setup ...

        document.body.appendChild(panel);

        header.addEventListener('mousedown', function(e) {
            // ... drag and drop logic ...
        });
    }
    ```

### 2\. Advanced Log Filtering

  * **What it does:** Instantly filters the logs view based on various criteria:
      * **Hide Hidden:** Hides domains you have manually added to a temporary hidden list.
      * **Hide Blocked:** Hides all domains that were blocked by NextDNS.
      * **Show Blocked:** Shows only domains that were blocked.
      * **Show Allowed:** Shows only domains that were explicitly allowed.
  * **How it improves the target interface:** Provides powerful client-side filtering that goes beyond the default NextDNS options, allowing for rapid log analysis and triage.
  * **Example usage or code snippet:**
    ```javascript
    // from script.js

    function cleanLogs() {
        document.querySelectorAll('div.list-group-item.log').forEach(row => {
            // ... logic to determine domain status ...

            let isVisible = true;
            if (filters.hideList && hideByDomainList) isVisible = false;
            if (filters.hideBlocked && isConsideredBlocked) isVisible = false;
            if (filters.showOnlyWhitelisted && !isConsideredAllowed) isVisible = false;
            if (filters.showOnlyBlocked && !(isConsideredBlocked && !isConsideredAllowed)) isVisible = false;

            row.style.display = isVisible ? '' : 'none';
        });
    }
    ```

### 3\. Inline Domain Actions & API Integration

  * **What it does:** Adds one-click action buttons directly to each log entry that interact with the NextDNS API to:
      * Block or allow the full domain or its root domain.
      * Temporarily hide the domain from the log view.
      * Open the domain in external services (Google Search, Who.is, URLVoid).
  * **How it improves the target interface:** Speeds up domain management. Instead of navigating menus and confirming each step, you can add or remove domains with a single click right in the log entry.
  * **Example usage or code snippet:**
    ```javascript
    // from script.js

    async function sendDomainViaApi(domain, mode = 'deny') {
        if (!NDNS_API_KEY) { /* ... */ return; }
        const pid = getCurrentProfileId();
        if (!pid) { /* ... */ return; }

        const endpoint = mode === 'deny' ? 'denylist' : 'allowlist';
        const apiUrl = `/profiles/${pid}/${endpoint}`;
        try {
            await makeApiRequest('POST', apiUrl, { id: domain, active: true }, NDNS_API_KEY);
            // ... update UI and local state ...
        } catch (error) {
            // ... handle error ...
        }
    }
    ```

### 4\. Data Export Utilities

  * **What it does:** The settings modal provides several data management tools:
      * **Export Blocked as HOSTS:** Fetches your log history via the API, extracts blocked domains, and generates a downloadable hosts file.
      * **Export/Import Hidden List:** Saves or loads your temporary hidden domains list as JSON.
      * **Export Full Profile:** Downloads a complete JSON backup of your NextDNS profile settings.
  * **How it improves the target interface:** Offers data portability and backup capabilities not natively available in the NextDNS interface.
  * **Example usage or code snippet:**
    ```javascript
    // from script.js

    async function onDownloadBlockedHosts(event) {
        // ... button spinner logic ...
        try {
            const response = await fetch(`https://api.nextdns.io/profiles/${profileId}/logs/download`);
            const csvText = await response.text();
            // ... CSV parsing logic to find blocked domains ...
            const hostsContent = Array.from(blockedDomains)
                .map(domain => `0.0.0.0 ${domain}`)
                .join('\n');
            downloadFile(hostsContent, 'hosts');
        } catch (error) {
            // ... error handling ...
        }
    }
    ```

### 5\. Automated API Key Setup

  * **What it does:** A guided, multi-step onboarding flow helps users retrieve and set their NextDNS API key. The extension directs the user to the correct account page, detects when a key is generated, and securely stores it for future use.
  * **How it improves the target interface:** Simplifies the process of finding and configuring the API key, which is essential for the extension’s core features.
  * **Example usage or code snippet:**
    ```javascript
    // from script.js

    function handleAccountPage() {
        if (document.getElementById('ndns-api-helper')) return;
        // ... creates a helper bar at the top of the /account page ...

        const updateHelperUI = () => {
            const apiKeyDiv = document.querySelector('div.font-monospace');
            if (apiKeyDiv && apiKeyDiv.textContent.trim()) {
                // ... logic to capture the key and return to the logs page ...
            }
        };
        // ...
    }
    ```

-----

## Installation

### Prerequisites

  * A modern web browser that supports Chrome extensions (e.g., Google Chrome, Microsoft Edge, or Brave).
  * An active NextDNS account.

### Step-by-step instructions

1.  Download the source code files (`manifest.json`, `script.js`, icon files) into a single folder on your computer.
2.  Open your browser’s extensions page (in Chrome or Edge, type `chrome://extensions` in the address bar and press Enter).
3.  Enable **Developer mode** in the top-right corner.
4.  Click **Load unpacked**.
5.  Select the folder where you saved the extension files.
6.  The NextDNS Ultimate Control Panel extension will appear and is ready to use.

-----

## Usage

  * **How to Load the Extension:** Navigate to `https://my.nextdns.io/` and log in. The extension will automatically activate on any page matching `my.nextdns.io/*`.
  * **How to Access and Use Each Feature:**
      * **Initial Setup:** On your first visit to a logs page, a modal will prompt you to set up your API key. Follow the on-screen instructions.
      * **Control Panel:** Hover over the left or right edge of the screen to reveal the panel.
      * **Filtering:** Click the filter buttons (e.g., "Hide Hidden", "Hide Blocked") to toggle each filter. The active filter is highlighted.
      * **Locking:** Click the lock icon to keep the panel visible even when the mouse moves away.
      * **Moving:** Drag the panel header to change its vertical position. Click the arrow icon to switch sides.
      * **Inline Actions:** In the logs view, hover over any entry to see new controls for deny, allow, hide, and external lookups.
      * **Settings Modal:** Click the gear icon in the panel to open advanced options such as theme selection, panel width, data export, and clearing hidden domains.

-----

## Configuration

The extension's settings are stored in your browser's local storage. Here are the main storage keys:

  * `ndns_panel_position_top_v2`: The vertical position of the control panel.
  * `ndns_panel_position_side_v2`: The side of the screen where the panel is located ('left' or 'right').
  * `ndns_filter_state_v2`: The state of the log filters.
  * `ndns_hidden_domains_v2`: A list of domains to hide from the logs.
  * `ndns_allowdeny_options_v2`: Options for the allow/deny list appearance.
  * `ndns_lock_state_v1`: Whether the panel is locked in the visible state.
  * `ndns_theme_v1`: The color theme for the panel ('light' or 'dark').
  * `ndns_panel_width_v1`: The width of the control panel.
  * `ndns_api_key`: Your NextDNS API key.
  * `ndns_profile_id_v1`: Your NextDNS profile ID.
  * `ndns_compact_mode_v1`: Toggles a more compact UI.
  * `ndns_domain_actions_v1`: A record of actions taken on domains.

-----

## Screenshots

*(This section would include screenshots or GIFs demonstrating the UI. As a language model, I cannot generate images.)*

-----

## Architecture

### File and folder layout

  * **manifest.json:** Defines the extension's metadata, permissions, and injects the content script.
  * **script.js:** The main content script containing all the logic for UI creation, state management, event handling, and API calls.
  * **icon\*.png:** Icons for the browser toolbar.

### Core modules and their responsibilities

  * **Compatibility Layer:** Ensures `chrome.storage` works across different browsers.
  * **Configuration & State:** Declares and manages variables for filters, API key, panel position, and domain lists.
  * **API Interaction:** The `makeApiRequest` function wraps all calls to the NextDNS API.
  * **UI Creation:** Functions like `createPanel` and `buildSettingsModal` are responsible for injecting the HTML and CSS for the extension's UI into the page.
  * **Core Logic:** `cleanLogs` handles the client-side filtering of logs, and various domain action functions manage API updates.
  * **Event Handling & Observers:** Attaches listeners to UI elements and uses a `MutationObserver` to process new log entries as they are loaded.
  * **Initialization:** The `main` function is the entry point that loads the extension's state and activates features based on the current page's URL.

-----

## API / Function Reference

| Function Name | Parameters | Return Value | Purpose within the extension |
| :--- | :--- | :--- | :--- |
| `initializeState()` | none | `Promise<void>` | Reads saved settings from storage and populates state variables. |
| `makeApiRequest(method, endpoint, body, apiKey)` | `string`, `string`, `object`, `string` | `Promise<object>` | Sends an API request to the NextDNS endpoint. |
| `createPanel()` | none | `Promise<void>` | Builds and injects the floating control panel into the page. |
| `buildSettingsModal()` | none | `HTMLElement` | Builds the HTML structure for the settings modal. |
| `cleanLogs()` | none | `void` | Applies filter rules to log entries and updates their visibility. |
| `sendDomainViaApi(domain, mode)` | `string`, `string` | `Promise<void>` | Adds a domain to the deny or allow list via the API. |
| `removeDomainViaApi(domain, listType)` | `string`, `string` | `Promise<void>` | Removes a domain from the specified list via the API. |
| `observeLogs()` | none | `void` | Watches for new log entries and triggers `cleanLogs`. |
| `main()` | none | `Promise<void>` | The entry point that initializes the extension based on the page context. |

-----

## Contributing

### How to report issues

If you find a bug or have a suggestion, please open an issue and include:

  * Steps to reproduce the issue.
  * What you expected to happen.
  * What actually happened.
  * Screenshots or console logs, if applicable.

### How to submit pull requests

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/my-new-feature`).
3.  Make your changes.
4.  Commit your work (`git commit -am 'Add new feature'`).
5.  Push to your branch (`git push origin feature/my-new-feature`).
6.  Open a pull request.

### Coding style guidelines

  * Use 4-space indentation.
  * Choose descriptive variable and function names.
  * Comment complex sections of logic.

-----

## Changelog

### [1.2] - 2025-07-11

*(This is a placeholder. A real changelog would detail updates for this version.)*

-----

## License

This project is licensed under the MIT License. See the LICENSE file for details.

-----

## Disclosure

This is an unofficial, third-party extension and is not affiliated with, endorsed, or supported by NextDNS in any way.
