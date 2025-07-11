# NextDNS Ultimate Control Panel

An unofficial browser extension that supercharges the NextDNS web interface with a powerful floating control panel for advanced filtering, bulk actions and streamlined domain management.

## 1 Introduction

### 1.1 Brief Overview

The NextDNS Ultimate Control Panel is a browser extension designed to enhance the user experience on the `my.nextdns.io` website. It injects a feature rich draggable control panel directly into the NextDNS logs and settings pages. This panel provides users with quick access to advanced log filtering, one click domain actions (allow, deny, hide), data export utilities and appearance customizations all without leaving the current page.

The core philosophy is to bring powerful management capabilities to your fingertips, reducing clicks and integrating seamlessly with the NextDNS API for a more efficient workflow.

## 2 Features

### 2.1 Floating Control Panel

**Description**  
A persistent, draggable and collapsible panel that provides centralized access to all extension features. It can be positioned on either side of the screen and locked in place.

**Improvement**  
Eliminates the need to navigate through different menus. All major functions are available in a single consolidated UI that hovers over the main content.

**Code Snippet**  
```js
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
````

### 2.2 Advanced Log Filtering

**Description**
Instantly filter the logs view based on various criteria

* Hide Hidden: hides domains you have manually added to a temporary hidden list
* Hide Blocked: hides all domains that were blocked by NextDNS
* Show Blocked: shows only domains that were blocked
* Show Allowed: shows only domains that were explicitly allowed

**Improvement**
Provides powerful client side filtering that goes beyond the default NextDNS options, allowing for rapid log analysis and triage.

**Code Snippet**

```js
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

### 2.3 Inline Domain Actions & API Integration

**Description**
Adds one click action buttons directly to each log entry. These buttons interact with the NextDNS API to:

* Block or allow the full domain or its root domain
* Temporarily hide the domain from the log view
* Open the domain in external services (Google Search, Who.is, URLVoid)

**Improvement**
Speeds up domain management. Instead of navigating menus and confirming each step, you can add or remove domains with a single click right in the log entry.

**Code Snippet**

```js
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

### 2.4 Data Export Utilities

**Description**
The settings modal provides several data management tools:

* Export Blocked as HOSTS: fetches your log history via the API, extracts blocked domains and generates a downloadable hosts file
* Export/Import Hidden List: save or load your temporary hidden domains list as JSON
* Export Full Profile: download a complete JSON backup of your NextDNS profile settings

**Improvement**
Offers data portability and backup capabilities not natively available in the NextDNS interface.

**Code Snippet**

```js
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

### 2.5 Automated API Key Setup

**Description**
A guided multi step onboarding flow helps users retrieve and set their NextDNS API key. The extension directs the user to the correct account page, detects when a key is generated and securely stores it for future use.

**Improvement**
Simplifies the process of finding and configuring the API key, which is essential for the extension’s core features.

**Code Snippet**

```js
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

## 3 Installation

### 3.1 Prerequisites

* A modern web browser that supports Chrome extensions (for example Google Chrome, Microsoft Edge or Brave)
* An active NextDNS account

### 3.2 Step by step Instructions

* Download the source code files (`manifest.json`, `script.js`, icon files) into a single folder on your computer
* Open your browser’s extensions page
* In Chrome or Edge type `chrome://extensions` in the address bar and press Enter
* Enable developer mode in the top right corner
* Click **Load unpacked**
* Select the folder where you saved the extension files
* The NextDNS Ultimate Control Panel extension will appear and is ready to use

## 4 Usage

### 4.1 How to Load the Extension

Navigate to `https://my.nextdns.io/` and log in. The extension will automatically activate on any page matching `my.nextdns.io/*`.

### 4.2 How to Access and Use Each Feature

* **Initial Setup**
  On first visit to a logs page a modal will prompt you to set up your API key. Follow on screen instructions.

* **Control Panel**
  Hover over the left or right edge of the screen to reveal the panel

* **Filtering**
  Click the filter buttons (Hide Hidden, Hide Blocked and so on) to toggle each filter. The active filter is highlighted

* **Locking**
  Click the lock icon to keep the panel visible even when the mouse moves away

* **Moving**
  Drag the panel header to change its vertical position. Click the arrow icon to switch sides

* **Inline Actions**
  In the logs view hover over any entry. New controls appear for deny, allow, hide and external lookups

* **Settings Modal**
  Click the gear icon in the panel to open advanced options such as theme selection panel width data export and clearing hidden domains

## 5 Architecture Overview

### 5.1 High level File Layout

* **manifest.json**: defines metadata permissions and injects the content script
* **script.js**: main content script containing UI creation state management event handling and API calls
* **icon*.png*\*: icons for the browser toolbar

### 5.2 Key Modules and Roles in script.js

* **Compatibility Layer**: ensures `chrome.storage` works across browsers
* **Configuration & State**: declares filters API key panel position and domain lists
* **API Interaction**: `makeApiRequest` wraps all NextDNS API calls
* **UI Creation**: functions like `createPanel` and `buildSettingsModal` inject HTML and CSS
* **Core Logic**: `cleanLogs` handles filtering; domain action functions manage API updates
* **Event Handling & Observers**: attaches listeners and uses a MutationObserver to process new log entries
* **Initialization**: `main` entry point loads state and activates features based on URL

## 6 Detailed Function Reference

| Function Name                                  | Parameters             | Return Value   | Purpose                                                          |                                              |
| ---------------------------------------------- | ---------------------- | -------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| initializeState()                              | none                   | Promise\<void> | Reads saved settings from storage and populates state variables  |                                              |
| makeApiRequest(method, endpoint, body, apiKey) | string, string, object | null, string   | Promise\<object>                                                 | Sends an API request to the NextDNS endpoint |
| createPanel()                                  | none                   | Promise\<void> | Builds and injects the floating control panel into the page      |                                              |
| buildSettingsModal()                           | none                   | HTMLElement    | Builds the HTML structure for the settings modal                 |                                              |
| cleanLogs()                                    | none                   | void           | Applies filter rules to log entries and updates their visibility |                                              |
| sendDomainViaApi(domain, mode)                 | string, string         | Promise\<void> | Adds a domain to the deny or allow list via the API              |                                              |
| removeDomainViaApi(domain, listType)           | string, string         | Promise\<void> | Removes a domain from the specified list via the API             |                                              |
| observeLogs()                                  | none                   | void           | Watches for new log entries and triggers `cleanLogs`             |                                              |
| main()                                         | none                   | Promise\<void> | Entry point that initializes the extension based on page context |                                              |

## 7 Contributing

We welcome contributions to improve the NextDNS Ultimate Control Panel

### 7.1 How to Report Issues

If you find a bug or have a suggestion please open an issue and include:

* Steps to reproduce the issue
* What you expected to happen
* What actually happened
* Screenshots or console logs if applicable

### 7.2 How to Submit Pull Requests

* Fork the repository
* Create a new branch (`git checkout -b feature/my-new-feature`)
* Make your changes
* Commit your work (`git commit -am 'Add new feature'`)
* Push to your branch (`git push origin feature/my-new-feature`)
* Open a pull request

### 7.3 Coding Style

* Use 4 space indentation
* Choose descriptive variable and function names
* Comment complex sections of logic

## 8 License

This project is licensed under the MIT License. See the LICENSE file for details.

> **Disclaimer**
> This is an unofficial third party extension and is not affiliated with, endorsed or supported by NextDNS in any way

```
```
