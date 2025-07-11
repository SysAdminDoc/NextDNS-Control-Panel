// --- BROWSER EXTENSION COMPATIBILITY LAYER ---
const storage = {
  local: (typeof browser !== "undefined" && browser.storage && browser.storage.local)
    ? browser.storage.local
    : chrome.storage.local,
  get: (keys) => {
    if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
      return browser.storage.local.get(keys);
    }
    return new Promise(resolve => {
      chrome.storage.local.get(keys, (result) => resolve(result));
    });
  },
  set: (items) => {
    if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
      return browser.storage.local.set(items);
    }
    return new Promise(resolve => {
      chrome.storage.local.set(items, () => resolve());
    });
  },
  remove: (keys) => {
     if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
      return browser.storage.local.remove(keys);
    }
    return new Promise(resolve => {
        chrome.storage.local.remove(keys, () => resolve());
    });
  }
};

function addGlobalStyle(css) {
    const head = document.head || document.getElementsByTagName('head')[0];
    if (head) {
        const style = document.createElement('style');
        style.textContent = css;
        head.appendChild(style);
    }
}
// --- END COMPATIBILITY LAYER ---

(function() {
    'use strict';

    // --- CONFIGURATION & STORAGE KEYS ---
    let NDNS_API_KEY = null;
    let globalProfileId = null;
    const KEY_PREFIX = 'ndns_';
    const KEY_POSITION_TOP = `${KEY_PREFIX}panel_position_top_v2`;
    const KEY_POSITION_SIDE = `${KEY_PREFIX}panel_position_side_v2`;
    const KEY_FILTER_STATE = `${KEY_PREFIX}filter_state_v2`;
    const KEY_HIDDEN_DOMAINS = `${KEY_PREFIX}hidden_domains_v2`;
    const KEY_ALLOWDENY_OPTIONS = `${KEY_PREFIX}allowdeny_options_v2`;
    const KEY_LOCK_STATE = `${KEY_PREFIX}lock_state_v1`;
    const KEY_THEME = `${KEY_PREFIX}theme_v1`;
    const KEY_WIDTH = `${KEY_PREFIX}panel_width_v1`;
    const KEY_API_KEY = `${KEY_PREFIX}api_key`;
    const KEY_PROFILE_ID = `${KEY_PREFIX}profile_id_v1`;
    const KEY_COMPACT_MODE = `${KEY_PREFIX}compact_mode_v1`;
    const KEY_DOMAIN_ACTIONS = `${KEY_PREFIX}domain_actions_v1`;

    // --- GLOBAL STATE ---
    let panel, lockButton, settingsModal, togglePosButton, settingsButton;
    let leftHeaderControls, rightHeaderControls;
    let isManuallyLocked = false;
    let filters = {};
    let allowDenyOptions = {};
    let hiddenDomains = new Set();
    let domainActions = {};
    let autoRefreshInterval = null;
    let currentTheme = 'dark';
    let panelWidth = 200;
    let isCompactMode = false;
    let isPreloadingCancelled = false;

    // --- SVG ICON BUILDER ---
    function buildSvgIcon(pathData, viewBox = '0 0 24 24') {
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('viewBox', viewBox);
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', pathData);
        svg.appendChild(path);
        return svg;
    }

    const icons = {
        unlocked: buildSvgIcon("M18 1a2 2 0 0 0-2 2v4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5V3a3 3 0 0 1 6 0v4a.5.5 0 0 1-1 0V3a2 2 0 0 0-2-2z"),
        locked: buildSvgIcon("M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"),
        arrowLeft: buildSvgIcon("M15 19l-7-7 7-7"),
        arrowRight: buildSvgIcon("M9 5l7 7-7 7"),
        settings: buildSvgIcon("M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17-.59-1.69-.98l-2.49-1c-.23-.09-.49 0-.61-.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19-.15-.24-.42-.12-.64l2 3.46c.12.22.39.3.61-.22l2.49-1c.52.4 1.08.73 1.69-.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22-.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"),
        eye: buildSvgIcon("M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12c-2.48 0-4.5-2.02-4.5-4.5S9.52 7.5 12 7.5s4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5zm0-7C10.62 9.5 9.5 10.62 9.5 12s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5S13.38 9.5 12 9.5z"),
        eyeSlash: buildSvgIcon("M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75C21.27 7.11 17 4.5 12 4.5c-1.6 0-3.14.35-4.6.98l2.1 2.1C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"),
        remove: buildSvgIcon("M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"),
        github: buildSvgIcon("M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.207 11.387.6.11.82-.26.82-.577 0-.285-.01-1.04-.015-2.04-3.338.725-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.085 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.291 0 .319.217.694.824.576C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z")
    };

    // --- INJECTED CSS ---
    addGlobalStyle(`
        :root, html[data-ndns-theme="dark"] {
            --panel-bg: #222; --panel-text: #fff; --panel-header-bg: #333; --panel-border: #444;
            --btn-bg: #444; --btn-hover-bg: #555; --btn-border: #555;
            --scrollbar-track: #333; --scrollbar-thumb: #555;
            --handle-color: #007bff; --input-bg: #333; --input-text: #f0f0f0; --input-border: #444;
            --success-color: #28a745; --danger-color: #dc3545; --info-color: #17a2b8;
        }
        html[data-ndns-theme="light"] {
            --panel-bg: #f8f9fa; --panel-text: #212529; --panel-header-bg: #e9ecef; --panel-border: #dee2e6;
            --btn-bg: #dee2e6; --btn-hover-bg: #ced4da; --btn-border: #ced4da;
            --scrollbar-track: #e9ecef; --scrollbar-thumb: #ced4da;
            --input-bg: #fff; --input-text: #495057; --input-border: #ced4da;
        }
        .ndns-panel { position: fixed; z-index: 9999; background: var(--panel-bg); color: var(--panel-text); border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); user-select: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; box-sizing: border-box; transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), border-color 0.3s; }
        .ndns-panel.left-side { left: 0; border-right: 10px solid var(--handle-color); transform: translateX(calc(-100% + 10px)); border-radius: 0 8px 8px 0; }
        .ndns-panel.right-side { right: 0; border-left: 10px solid var(--handle-color); transform: translateX(calc(100% - 10px)); border-radius: 8px 0 0 8px; }
        .ndns-panel.visible { transform: translateX(0); }
        .ndns-panel-header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 5px; padding: 8px; cursor: move; background-color: var(--panel-header-bg); font-size: 14px; font-weight: bold; }
        .ndns-header-title { text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ndns-panel.left-side .ndns-panel-header { border-top-right-radius: 8px; }
        .ndns-panel.right-side .ndns-panel-header { border-top-left-radius: 8px; }
        .panel-header-controls { display: flex; align-items: center; gap: 2px; }
        .panel-header-controls button, .panel-header-controls a { background: transparent; border: none; color: var(--panel-text); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; opacity: 0.7; }
        .panel-header-controls button:hover, .panel-header-controls a:hover { background-color: rgba(125, 125, 125, 0.2); opacity: 1; }
        .panel-header-controls svg { pointer-events: none; width: 22px; height: 22px; }
        .ndns-panel-content { padding: 10px; display: flex; flex-direction: column; gap: 8px; max-height: calc(100vh - 150px); overflow-y: auto; }
        .ndns-panel-content::-webkit-scrollbar { width: 8px; }
        .ndns-panel-content::-webkit-scrollbar-track { background: var(--scrollbar-track); border-radius: 4px; }
        .ndns-panel-content::-webkit-scrollbar-thumb { background-color: var(--scrollbar-thumb); border-radius: 4px; }
        .ndns-panel-button { background-color: var(--btn-bg); color: var(--panel-text); border: 1px solid var(--btn-border); border-radius: 5px; padding: 6px 10px; font-size: 13px; cursor: pointer; transition: background-color 0.2s; text-align: center; width: 100%; box-sizing: border-box; }
        .ndns-panel-button:hover { background-color: var(--btn-hover-bg); }
        .ndns-panel-button.active { background-color: var(--success-color); color: white; }
        .preload-container { display: flex; gap: 5px; margin-top: 8px; border: 1px solid var(--panel-border); border-radius: 4px; padding: 5px; }
        .preload-container select { flex-grow: 1; background: var(--input-bg); color: var(--input-text); border: none; border-radius: 3px; }
        .preload-container button { background-color: var(--handle-color); color: white; }
        .danger-button { background-color: var(--danger-color) !important; color: white !important; }
        .ndns-divider { height: 1px; background-color: var(--panel-border); margin: 6px 0; }
        .ndns-collapsible-section summary { cursor: pointer; font-weight: bold; opacity: 0.9; font-size: 12px; padding: 4px 0; }
        .ndns-collapsible-section-content { display: flex; flex-direction: column; gap: 8px; padding: 10px 0 4px 0; }
        .ndns-settings-modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.6); z-index: 10000; justify-content: center; align-items: center; }
        .ndns-settings-modal-content { background: var(--panel-bg); color: var(--panel-text); padding: 20px; border-radius: 8px; width: 90%; max-width: 450px; box-shadow: 0 5px 25px rgba(0,0,0,0.4); position: relative; }
        .ndns-settings-modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--panel-border); padding-bottom: 10px; margin-bottom: 10px; }
        .ndns-settings-modal-header h3 { margin: 0; }
        .ndns-settings-modal-header .github-link { display: flex; align-items: center; text-decoration: none; color: var(--panel-text); opacity: 0.6; font-size: 12px; font-weight: normal; margin-left: auto; padding-left: 15px; }
        .ndns-settings-modal-header .github-link:hover { opacity: 1; }
        .ndns-settings-modal-header .github-link svg { width: 16px; height: 16px; margin-right: 5px; }
        .ndns-settings-close-btn { position: absolute; top: 10px; right: 10px; background: none; border: none; cursor: pointer; color: var(--panel-text); font-size: 24px; padding: 5px;}
        .ndns-settings-section { margin-top: 20px; }
        .ndns-settings-section > label { display: block; margin-bottom: 10px; font-weight: bold; }
        .ndns-settings-controls { display: flex; flex-direction: column; gap: 5px; }
        .settings-control-row { display: flex; justify-content: space-between; align-items: center; }
        .settings-control-row .btn-group { display: flex; gap: 5px; }
        .custom-switch { display: flex; align-items: center; }
        .custom-switch label { margin-left: 10px; user-select: none; cursor: pointer; }
        .ndns-blocklist-info { margin-left: 10px; font-size: 0.8em; color: #ff8b8b; font-style: italic; user-select: text; white-space: nowrap; }
        .ndns-inline-controls { display: flex; align-items: center; gap: 6px; margin-left: auto; }
        .ndns-inline-controls button { cursor: pointer; background: transparent; border: none; font-size: 14px; padding: 0 4px; }
        .ndns-inline-controls span { margin-left: 3px; }
        .ndns-inline-controls .divider { border-left: 1px solid rgba(150, 150, 150, 0.4); margin: 0 8px; height: 20px; align-self: center; }
        .list-group-item .notranslate strong { font-weight: bold !important; color: var(--panel-text) !important; }
        .list-group-item .notranslate .subdomain { opacity: 0.6; }
        .list-group-item .remove-list-item-btn { margin-left: auto; background: none; border: none; color: var(--danger-color); cursor: pointer; opacity: 0.6; }
        .list-group-item .remove-list-item-btn:hover { opacity: 1; }

        /* --- MODAL & ONBOARDING STYLES --- */
        #ndns-onboarding-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); z-index: 10002; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        #ndns-onboarding-modal { background: #2c2c2c; color: #fff; padding: 30px; border-radius: 12px; width: 90%; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; border: 1px solid #444; transform: scale(0.95); animation: zoomIn 0.3s ease-out forwards; position: relative; }
        @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        #ndns-onboarding-modal h3 { font-size: 24px; margin-top: 0; margin-bottom: 15px; }
        #ndns-onboarding-modal p { color: #ccc; font-size: 16px; margin-bottom: 25px; }
        #ndns-onboarding-modal .api-input-wrapper { display: flex; gap: 10px; margin-top: 20px; position: relative; }
        #ndns-onboarding-modal input { flex-grow: 1; padding: 12px; border-radius: 6px; border: 1px solid #555; background: #222; color: #fff; font-size: 16px; }
        .ndns-flashy-button { background: linear-gradient(45deg, #a855f7, #ec4899, #22d3ee, #f59e0b); background-size: 300% 300%; animation: gradient-shift 4s ease infinite, bubble-bounce 1s ease-out; transition: transform 0.2s ease; position: relative; overflow: hidden; border: none; color: white !important; width: 100%; padding: 14px; margin-top: 20px; border-radius: 6px; font-size: 18px; font-weight: bold; cursor: pointer; }
        .ndns-flashy-button:hover { transform: scale(1.02); }
        @keyframes gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes bubble-bounce { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        
        /* --- LOGIN SPOTLIGHT & ACCOUNT PAGE STYLES --- */
        .ndns-spotlight-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(20, 20, 20, 0.7); backdrop-filter: blur(5px); z-index: 10000; }
        .ndns-login-focus { position: relative !important; z-index: 10001 !important; background: var(--panel-bg, #222); padding: 20px; border-radius: 12px; }
        .ndns-affiliate-pitch { position: fixed; z-index: 10001; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; text-align: center; max-width: 500px; font-size: 16px; line-height: 1.6; }
        .ndns-affiliate-pitch p { margin-bottom: 1em; }
        .ndns-affiliate-pitch a { color: var(--info-color); font-weight: bold; }
        .ndns-spotlight-close { position: fixed; top: 20px; right: 20px; z-index: 10002; font-size: 30px; color: white; cursor: pointer; opacity: 0.7; }
        .ndns-spotlight-close:hover { opacity: 1; }
        .ndns-api-helper {
            position: sticky; top: 0; z-index: 10001; background: #2c2c2c; color: white;
            padding: 15px; text-align: center; box-shadow: 0 4px 8px rgba(0,0,0,0.5); border-bottom: 1px solid #444;
            display: flex; align-items: center; justify-content: center; gap: 15px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .ndns-api-helper p { margin: 0; font-size: 16px; font-weight: bold; }
        .ndns-api-helper button { padding: 8px 16px; font-size: 14px; font-weight: bold; border-radius: 5px; border: none; cursor: pointer; transition: all 0.2s ease; position: relative; overflow: hidden; }
        .ndns-api-helper .save-key-btn { background-color: var(--info-color); color: white; }
        .ndns-api-helper .save-key-btn:hover { background-color: #19b9d1; }
        .ndns-api-helper .generate-key-btn { background: linear-gradient(45deg, #a855f7, #ec4899); background-size: 200% 200%; animation: gradient-shift 3s ease infinite; color: white; }
        .ndns-api-helper button:disabled { background-color: var(--success-color) !important; cursor: not-allowed; animation: none; }
        
        /* --- UI POLISH STYLES --- */
        .ndns-panel-button.auto-refresh-active {
            background: linear-gradient(270deg, #17a2b8, #28a745, #17a2b8);
            background-size: 200% 200%;
            animation: gradient-shine 2s linear infinite;
            color: white;
        }
        @keyframes gradient-shine { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        html.ndns-compact-mode .ndns-panel-button { padding: 4px 8px; font-size: 12px; }
        html.ndns-compact-mode .ndns-panel-content { gap: 5px; }
        html.ndns-compact-mode .ndns-inline-controls { gap: 4px; }
        html.ndns-compact-mode .ndns-inline-controls button { font-size: 12px; }
        .api-key-wrapper { position: relative; display: flex; align-items: center; }
        .api-key-wrapper input { padding-right: 40px !important; }
        .api-key-toggle-visibility { position: absolute; right: 10px; background: none; border: none; cursor: pointer; color: var(--panel-text); opacity: 0.6; }
        .api-key-toggle-visibility:hover { opacity: 1; }
        .api-key-toggle-visibility svg { width: 20px; height: 20px; }

        /* --- HOSTS BUTTON STYLES --- */
        #export-hosts-btn {
            display: inline-flex; align-items: center; justify-content: center;
            transition: background-color 0.3s, box-shadow 0.3s, transform 0.1s;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
        }
        #export-hosts-btn:hover {
            box-shadow: 0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23);
        }
        #export-hosts-btn:active {
            transform: translateY(1px);
        }
        #export-hosts-btn .spinner {
            display: none;
            margin-left: 8px; border: 2px solid #f3f3f3;
            border-top: 2px solid #3498db; border-radius: 50%;
            width: 14px; height: 14px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .ndns-panel-header .panel-header-controls button svg {
            overflow: visible !important;
            fill: currentColor !important;
            mask: none !important;
            clip-path: none !important;
        }

        /* --- CSS Overhaul START: Revised spinner glow --- */
        .stream-button.streaming,
        .stream-button.auto-refresh-active {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 4px;
            border-radius: 50%;
            background: linear-gradient(270deg, #17a2b8, #28a745, #17a2b8);
            background-size: 200% 200%;
            animation: gradient-shine 2s linear infinite;
        }
        .stream-button svg {
            width: 18px;
            height: 18px;
            fill: white;
        }
        /* --- CSS Overhaul END: Revised spinner glow --- */
    `);

    //—— Special Effects & Notifications ——————————————————————
    function showToast(msg, isError = false, duration = 4000) {
        let existingToast = document.querySelector('.ndns-toast-countdown');
        if (existingToast) existingToast.remove();

        const n = document.createElement('div');
        n.id = `ndns-toast-${Date.now()}`;
        n.className = 'ndns-toast-countdown';
        n.textContent = msg;
        Object.assign(n.style, {
            position: 'fixed', bottom: '20px', right: '20px',
            background: isError ? 'var(--danger-color)' : 'var(--success-color)',
            color: '#fff', padding: '10px 15px', borderRadius: '4px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)', zIndex: 20000,
            transform: 'translateY(100px)', opacity: '0',
            transition: 'transform 0.4s ease, opacity 0.4s ease'
        });
        document.body.appendChild(n);
        setTimeout(() => {
            n.style.transform = 'translateY(0)';
            n.style.opacity = '1';
        }, 10);
        setTimeout(() => {
            n.style.transform = 'translateY(100px)';
            n.style.opacity = '0';
            n.addEventListener('transitionend', () => n.remove());
        }, duration);
        return n;
    }

    //—— State Management ———————————————————————————————————
    async function initializeState() {
        const defaultFilters = { hideList: false, hideBlocked: false, showOnlyBlocked: false, showOnlyWhitelisted: false, autoRefresh: false };
        const defaultAllowDenyOptions = { boldRoot: true, lightenSubdomain: true, sortAZ: false, sortTLD: false, sortRoot: false };
        const values = await storage.get({
            [KEY_FILTER_STATE]: defaultFilters,
            [KEY_HIDDEN_DOMAINS]: ['nextdns.io'],
            [KEY_ALLOWDENY_OPTIONS]: defaultAllowDenyOptions,
            [KEY_LOCK_STATE]: true,
            [KEY_THEME]: 'dark',
            [KEY_WIDTH]: 200,
            [KEY_API_KEY]: null,
            [KEY_PROFILE_ID]: null,
            [KEY_COMPACT_MODE]: false,
            [KEY_DOMAIN_ACTIONS]: {}
        });
        filters = { ...defaultFilters, ...values[KEY_FILTER_STATE] };
        hiddenDomains = new Set(values[KEY_HIDDEN_DOMAINS]);
        allowDenyOptions = { ...defaultAllowDenyOptions, ...values[KEY_ALLOWDENY_OPTIONS] };
        isManuallyLocked = values[KEY_LOCK_STATE];
        currentTheme = values[KEY_THEME];
        panelWidth = values[KEY_WIDTH];
        NDNS_API_KEY = values[KEY_API_KEY];
        globalProfileId = values[KEY_PROFILE_ID];
        isCompactMode = values[KEY_COMPACT_MODE];
        domainActions = values[KEY_DOMAIN_ACTIONS];
    }

    //—— API & Core Logic ————————————————————————
    async function makeApiRequest(method, endpoint, body = null, apiKey = NDNS_API_KEY) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, `https://api.nextdns.io${endpoint}`);
            xhr.withCredentials = true;
            xhr.setRequestHeader('X-Api-Key', apiKey);
            if (body) {
                xhr.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
            }
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { resolve(JSON.parse(xhr.responseText)); } catch (e) { resolve({}); }
                } else { reject(new Error(`${xhr.status}: ${xhr.statusText}`)); }
            };
            xhr.onerror = () => reject(new Error('Network request failed'));
            xhr.send(body ? JSON.stringify(body) : null);
        });
    }

    function getProfileID() {
        const m = window.location.pathname.match(/\/([a-z0-9]+)\//);
        return m ? m[1] : null;
    }

    function getCurrentProfileId() {
        return globalProfileId || getProfileID();
    }

    function extractRootDomain(domain) {
        const parts = domain.split('.');
        if (parts.length < 2) return domain;
        const slds = new Set(['co', 'com', 'org', 'gov', 'edu', 'net', 'ac', 'ltd']);
        if (parts.length > 2 && slds.has(parts[parts.length - 2])) {
            return parts.slice(-3).join('.');
        }
        return parts.slice(-2).join('.');
    }
    
    function downloadFile(content, fileName, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function onDownloadBlockedHosts(event) {
        const button = event.currentTarget;
        const spinner = button.querySelector('.spinner');
        const buttonText = button.querySelector('span');
        const originalText = buttonText.textContent;
        const profileId = getCurrentProfileId();

        if (!profileId) {
            showToast('Error: Could not detect Profile ID.', true);
            return;
        }
        
        button.disabled = true;
        buttonText.textContent = 'Processing...';
        spinner.style.display = 'inline-block';
        
        try {
            const response = await fetch(
              `https://api.nextdns.io/profiles/${profileId}/logs/download`,
              {
                method:  'GET',
                credentials: 'include',
                headers: { 'X-Api-Key': NDNS_API_KEY }
              }
            );

            if (!response.ok) {
              throw new Error(`API Request Failed: ${response.status} ${response.statusText}`);
            }
            
            const csvText = await response.text();
            
            const lines = csvText.trim().split('\n');
            const header = lines.shift().split(',').map(h => h.trim());
            const domainIndex = header.indexOf('domain');
            const reasonsIndex = header.indexOf('reasons');
            
            if (domainIndex === -1 || reasonsIndex === -1) {
                throw new Error('CSV is missing "domain" or "reasons" column.');
            }

            const blockedDomains = new Set();
            lines.forEach(line => {
                const columns = line.split(',');
                const reasons = (columns[reasonsIndex] || '').toLowerCase();
                if (reasons.includes('blacklist') || reasons.includes('blocklist')) {
                    const domain = columns[domainIndex];
                    if (domain) blockedDomains.add(domain);
                }
            });
            
            const hostsContent = Array.from(blockedDomains).map(domain => `0.0.0.0 ${domain}`).join('\n');
            downloadFile(hostsContent, 'hosts');
            showToast('HOSTS file generated and download started.', false);

        } catch (error) {
            console.error('Error creating HOSTS file:', error);
            showToast(`Failed to create HOSTS file: ${error.message}`, true, 5000);
        } finally {
            button.disabled = false;
            buttonText.textContent = originalText;
            spinner.style.display = 'none';
        }
    }

    //—— API Key & Onboarding Flow ——————————————
    
    function showOnboardingModal(options = {}) {
        let existingOverlay = document.getElementById('ndns-onboarding-overlay');
        if (existingOverlay) existingOverlay.remove();
        
        const overlay = document.createElement('div');
        overlay.id = 'ndns-onboarding-overlay';
        
        let modalHTML = `
            <h3>API Key Required</h3>
            <p>Let's grab your API key from your NextDNS account page to unlock the panel's features.</p>
            <button id="ndns-get-api-key-btn" class="ndns-flashy-button">Take me there!</button>
        `;

        if (options.manual) {
            const profileId = getCurrentProfileId();
            modalHTML = `
                <h3>Manual API Key Entry</h3>
                <p>Your API Key has been copied to your clipboard. To use it, right-click and paste it into the API Key field.</p>
                <div class="api-input-wrapper">
                    <input type="text" id="ndns-manual-api-input" placeholder="Paste API Key here...">
                </div>
                <button id="ndns-manual-api-submit" class="ndns-flashy-button">Accept API Key</button>
                <a href="https://my.nextdns.io/${profileId}/api" target="_blank" style="display: block; font-size: 12px; color: #ccc; margin-top: 15px; text-decoration: underline;">Didn’t copy the key? Click here to return to the API page.</a>
            `;
        }

        overlay.innerHTML = `<div id="ndns-onboarding-modal">${modalHTML}</div>`;
        document.body.appendChild(overlay);

        if (options.manual) {
            document.getElementById('ndns-manual-api-submit').onclick = async () => {
                const key = document.getElementById('ndns-manual-api-input').value;
                if (key) {
                    const settingsSaveBtn = settingsModal.querySelector('#ndns-settings-save-api-key-btn');
                    const settingsInput = settingsModal.querySelector('.api-key-wrapper input');
                    if (settingsInput && settingsSaveBtn) {
                        settingsInput.value = key;
                        settingsSaveBtn.click();
                        overlay.remove();
                    }
                } else {
                    showToast("Please paste a key.", true);
                }
            };
        } else {
            document.getElementById('ndns-get-api-key-btn').onclick = () => {
                 sessionStorage.setItem('ndnsRedirectUrl', window.location.href);
                 window.location.href = 'https://my.nextdns.io/account';
            };
        }
    }

    function createLoginSpotlight() {
        const loginForm = document.querySelector('.col-xl-4.col-lg-5');
        if (!loginForm) return;

        const overlay = document.createElement('div');
        overlay.className = 'ndns-spotlight-overlay';

        const pitch = document.createElement('div');
        pitch.className = 'ndns-affiliate-pitch';
        pitch.innerHTML = `
            <p>To get the most out of this extension, you'll want to sign in and use an API key, it enables full automation and granular domain control.</p>
            <p>NextDNS Pro is just $1.99/month and gives you network-wide DNS blocking.</p>
            <p>Support the project by signing up through my affiliate link:<br><a href="https://nextdns.io/?from=6mrqtjw2" target="_blank">https://nextdns.io/?from=6mrqtjw2</a></p>
        `;
        
        const closeBtn = document.createElement('span');
        closeBtn.className = 'ndns-spotlight-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => {
            overlay.remove();
            pitch.remove();
            closeBtn.remove();
            loginForm.classList.remove('ndns-login-focus');
        };
        
        document.body.appendChild(overlay);
        document.body.appendChild(pitch);
        document.body.appendChild(closeBtn);
        loginForm.classList.add('ndns-login-focus');
    }

    function handleAccountPage() {
        if (document.getElementById('ndns-api-helper')) return;

        const dimOverlay = document.createElement('div');
        dimOverlay.className = 'ndns-dim-overlay';
        document.body.appendChild(dimOverlay);

        const helper = document.createElement('div');
        helper.id = 'ndns-api-helper';
        helper.className = 'ndns-api-helper';
        document.body.prepend(helper);

        const updateHelperUI = () => {
            const apiKeyDiv = document.querySelector('div.font-monospace');
            const generateButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Generate API key'));
            const proPlanCard = Array.from(document.querySelectorAll('.card-title')).find(el => el.textContent.includes('Pro'))?.closest('.row');

            helper.innerHTML = '';
            const message = document.createElement('p');
            const actionButton = document.createElement('button');
            helper.appendChild(message);
            helper.appendChild(actionButton);
            actionButton.style.display = 'block';

            if (apiKeyDiv && apiKeyDiv.textContent.trim()) {
                message.textContent = '✅ API Key found!';
                actionButton.textContent = 'Capture Key & Return to Logs';
                actionButton.className = 'save-key-btn';
                actionButton.onclick = async () => {
                    const apiKey = apiKeyDiv.textContent.trim();
                    navigator.clipboard.writeText(apiKey);
                    await storage.set({ 
                        'ndns_api_key_to_transfer': apiKey,
                        'ndns_return_from_account': true
                    });
                    const redirectUrl = globalProfileId ? `https://my.nextdns.io/${globalProfileId}/logs` : 'https://my.nextdns.io/';
                    showToast('API Key captured! Returning...', false, 2000);
                    setTimeout(() => { window.location.href = redirectUrl; }, 800);
                };
            } else if (generateButton) {
                message.textContent = '❗️ Your API Key isn\'t generated yet.';
                actionButton.textContent = 'Generate API Key';
                actionButton.className = 'generate-key-btn';
                actionButton.onclick = () => {
                    generateButton.click();
                    showToast('Generating key... Page will reload.', false, 2000);
                    setTimeout(() => location.reload(), 1000);
                };
            } else if (proPlanCard) {
                helper.style.transition = 'opacity 0.5s';
                helper.style.opacity = '0.5';
                helper.style.pointerEvents = 'none';
                message.innerHTML = `<b>Couldn’t create an API key.</b><br>You’ll need to upgrade to <b>NextDNS Pro</b> to use this feature. It’s just $1.99/month and unlocks full domain API control which this extension utilizes for core functions.`;
                actionButton.textContent = 'Upgrade to Pro';
                actionButton.className = 'save-key-btn';
                actionButton.onclick = () => window.open('https://nextdns.io/?from=6mrqtjw2', '_blank');
                actionButton.style.display = 'block';
                helper.appendChild(actionButton);
                proPlanCard.style.boxShadow = '0 0 0 3px var(--info-color)';
                proPlanCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                message.textContent = 'Please create an account or login to access your API key.';
                actionButton.style.display = 'none';
            }
        };

        helper.innerHTML = `<p>⏳ Looking for the API section...</p>`;
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

        setTimeout(() => {
            updateHelperUI();
            const observer = new MutationObserver(() => updateHelperUI());
            const targetNode = Array.from(document.querySelectorAll('h5')).find(h => h.textContent === 'API Keys')?.closest('.card');
            if (targetNode) {
                observer.observe(targetNode, { childList: true, subtree: true });
            }
        }, 1500);
    }

    async function finalizeApiKeySetup() {
        try {
            const data = await storage.get(['ndns_api_key_to_transfer']);
            const apiKey = data.ndns_api_key_to_transfer;

            await storage.remove(['ndns_api_key_to_transfer', 'ndns_return_from_account']);

            if (!apiKey || !/^[a-f0-9]{60,}/i.test(apiKey)) {
                throw new Error("Failed to retrieve a valid API key.");
            }
            
            const profileId = getCurrentProfileId();
            if (!profileId) {
                throw new Error("Could not find Profile ID.");
            }
            
            await makeApiRequest('GET', `/profiles/${profileId}`, null, apiKey);

            const apiKeyInput = settingsModal.querySelector('.api-key-wrapper input');
            const apiKeySaveBtn = settingsModal.querySelector('#ndns-settings-save-api-key-btn');

            if (!apiKeyInput || !apiKeySaveBtn) {
                throw new Error("Could not find settings elements.");
            }

            apiKeyInput.value = apiKey.trim();
            showToast("API Key validated. Submitting automatically...", false, 2500);

            setTimeout(() => apiKeySaveBtn.click(), 2000);

        } catch (err) {
            showOnboardingModal({ manual: true });
        }
    }

    //—— Panel & Page-Specific Functions ——————————
    async function autoScrollLog(scrollCount) {
        if (!scrollCount || isNaN(scrollCount)) return;

        const preloadBtn = document.getElementById('preload-btn');
        const selectEl = preloadBtn.previousElementSibling;
        if (!preloadBtn || !selectEl) return;

        isPreloadingCancelled = false;
        const originalOnClick = () => autoScrollLog(parseInt(selectEl.value, 10));

        preloadBtn.textContent = 'Cancel';
        preloadBtn.classList.add('danger-button');
        selectEl.disabled = true;
        preloadBtn.onclick = () => { isPreloadingCancelled = true; };

        const originalFilters = { ...filters };
        const hadActiveFilters = Object.values(originalFilters).some(v => v === true);
        const originalScrollY = window.scrollY;

        try {
            if (hadActiveFilters) {
                showToast('Temporarily showing all logs to preload...', false, 2500);
                Object.keys(filters).forEach(k => { if (typeof filters[k] === 'boolean') filters[k] = false; });
                cleanLogs();
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            const scrollDelay = 3000;
            const toast = showToast(`Preloading logs... 0 / ${scrollCount}`, false, (scrollCount * scrollDelay) + 2000);

            for (let i = 0; i < scrollCount; i++) {
                if (isPreloadingCancelled) {
                    toast.textContent = 'Preloading cancelled.';
                    break;
                }
                toast.textContent = `Preloading... ${i + 1} / ${scrollCount}`;
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(resolve => setTimeout(resolve, scrollDelay));
            }
            if (!isPreloadingCancelled) {
                 toast.textContent = 'Preloading complete!';
            }
        } finally {
            if (hadActiveFilters) {
                Object.assign(filters, originalFilters);
                cleanLogs();
                await storage.set({ [KEY_FILTER_STATE]: filters });
            }
            preloadBtn.textContent = 'Preload';
            preloadBtn.classList.remove('danger-button');
            selectEl.disabled = false;
            preloadBtn.onclick = originalOnClick;
            window.scrollTo({ top: originalScrollY, behavior: 'instant' });
        }
    }

    async function clearHiddenDomains() {
        if (confirm('Are you sure you want to clear all hidden domains from the list?')) {
            hiddenDomains.clear();
            hiddenDomains.add('nextdns.io');
            await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
            showToast('Cleared hidden domains.');
            cleanLogs();
            return true;
        }
        return false;
    }

    async function updateDomainAction(domain, type, level) {
        if (type === 'remove') {
            delete domainActions[domain];
        } else {
            domainActions[domain] = { type, level };
        }
        await storage.set({ [KEY_DOMAIN_ACTIONS]: domainActions });
    }

    async function sendDomainViaApi(domain, mode = 'deny') {
        if (!NDNS_API_KEY) {
            showToast('API Key not set. Please go to your Account page to set it.', true);
            return;
        }
        const pid = getCurrentProfileId();
        if (!pid) {
            showToast('Could not find NextDNS profile ID.', true);
            return;
        }
        const domainToSend = domain.replace(/^\*\./, '');
        const endpoint = mode === 'deny' ? 'denylist' : 'allowlist';
        const apiUrl = `/profiles/${pid}/${endpoint}`;
        try {
            await makeApiRequest('POST', apiUrl, { "id": domainToSend, "active": true }, NDNS_API_KEY);
            hiddenDomains.add(domain);
            await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
            const level = domain === extractRootDomain(domain) ? 'root' : 'sub';
            await updateDomainAction(domain, mode, level);
            showToast(`${domain} successfully added to ${endpoint} list and hidden!`);
            cleanLogs();
        } catch (error) {
            showToast(`API Request Error: ${error.message || 'Unknown Error'}`, true);
        }
    }

    async function removeDomainViaApi(domain, listType) {
        if (!NDNS_API_KEY) return showToast('API Key not set.', true);
        const pid = getCurrentProfileId();
        if (!pid) return showToast('Could not find Profile ID.', true);

        const endpoint = `/profiles/${pid}/${listType}/${domain}`;
        try {
            await makeApiRequest('DELETE', endpoint, null, NDNS_API_KEY);
            await updateDomainAction(domain, 'remove');
            showToast(`${domain} removed from ${listType}.`);
            cleanLogs();
            if (/\/denylist|\/allowlist/.test(location.href)) {
                 document.querySelectorAll(".list-group-item").forEach(item => {
                    const domainEl = item.querySelector('.notranslate');
                    if (domainEl && domainEl.textContent.trim() === domain) {
                        item.style.transition = 'opacity 0.3s';
                        item.style.opacity = '0';
                        setTimeout(() => item.remove(), 300);
                    }
                });
            }
        } catch (error) {
            showToast(`Error removing domain: ${error.message}`, true);
        }
    }


    async function createRowButtons(row, domain) {
        if (row.querySelector('.ndns-inline-controls')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'ndns-inline-controls';
        const createLabeledButton = (label, title, action) => {
            const b = document.createElement('button');
            b.title = title;
            b.onclick = action;
            const icon = document.createElement('span');
            icon.textContent = label.icon;
            if (label.text) {
                b.append(icon, document.createTextNode(label.text));
            } else {
                b.textContent = label.icon;
            }
            return b;
        };
        const createDivider = () => {
            const d = document.createElement('span');
d.className = 'divider';
            return d;
        };
		const onHide = async (domToHide) => {
			hiddenDomains.add(domToHide);
			await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
			cleanLogs();
			showToast(`Hidden: ${domToHide}`);
		};

        const buttons = [
            createLabeledButton({ icon: '🚫', text: 'Full' }, 'Block Full Domain', () => sendDomainViaApi(domain, 'deny')),
            createLabeledButton({ icon: '⛔', text: 'Root' }, 'Block Root Domain', () => sendDomainViaApi(extractRootDomain(domain), 'deny')),
            createDivider(),
            createLabeledButton({ icon: '✅', text: 'Full' }, 'Allow Full Domain', () => sendDomainViaApi(domain, 'allow')),
            createLabeledButton({ icon: '🟢', text: 'Root' }, 'Allow Root Domain', () => sendDomainViaApi(extractRootDomain(domain), 'allow')),
            createDivider(),
            createLabeledButton({ icon: '👁️‍🗨️', text: 'Full' }, 'Hide Full from Log', () => onHide(domain)),
            createLabeledButton({ icon: '👁️‍🗨️', text: 'Root' }, 'Hide Root from Log', () => onHide(extractRootDomain(domain))),
            createDivider(),
            createLabeledButton({ icon: '🔍' }, 'Google Search', () => window.open(`https://www.google.com/search?q=${encodeURIComponent(domain)}`, '_blank')),
            createLabeledButton({ icon: '🕵️' }, 'Who.is Lookup', () => window.open(`https://www.who.is/whois/${encodeURIComponent(extractRootDomain(domain))}`, '_blank')),
            createLabeledButton({ icon: '⚡' }, 'URLVoid Scan', () => window.open(`https://www.urlvoid.com/scan/${encodeURIComponent(extractRootDomain(domain))}`, '_blank'))
        ];
        
        buttons.forEach(btn => wrapper.appendChild(btn));
        const targetEl = row.querySelector('.flex-grow-1.d-flex.align-items-center.text-break');
        if (targetEl) targetEl.appendChild(wrapper);
    }

    function cleanLogs() {
        document.querySelectorAll('div.list-group-item.log').forEach(row => {
            row.querySelector('svg[data-icon="ellipsis-vertical"]')?.closest('.dropdown')?.style.setProperty('display', 'none', 'important');
            let domain = row.querySelector('.text-break > div > span')?.innerText.trim() || row.querySelector('.text-break')?.innerText.trim().match(/^([a-zA-Z0-9.-]+)/)?.[0];
            if (!domain) return;
            createRowButtons(row, domain);

            const rootDomain = extractRootDomain(domain);
            const domainAction = domainActions[domain];
            const rootAction = domainActions[rootDomain];
            let historicalAction = domainAction || rootAction;

            if (historicalAction) {
                const borderStyle = historicalAction.level === 'root' ? 'solid' : 'dotted';
                const borderColor = historicalAction.type === 'deny' ? 'var(--danger-color)' : 'var(--success-color)';
                row.style.borderLeft = `4px ${borderStyle} ${borderColor}`;
            }

            if (!row.querySelector('.ndns-blocklist-info')) {
                const reasonEl = row.querySelector('.reason[title]');
                if (reasonEl) {
                    const tooltipText = reasonEl.getAttribute('title');
                    const blockedByMatch = tooltipText.match(/Blocked by\s+(.+)/i);
                    if (blockedByMatch?.[1]) {
                        const infoElement = document.createElement('span');
                        infoElement.className = 'ndns-blocklist-info';
                        infoElement.textContent = `(${blockedByMatch[1].replace(/\.$/, '').trim()})`;
                        row.querySelector('.flex-grow-1.d-flex.align-items-center.text-break > div')?.appendChild(infoElement);
                    }
                }
            }

            const isBlockedByReason = !!row.querySelector('.reason-icon');
            const isWhitelisted = row.style.borderLeft.includes('rgb(46, 204, 64)');
            const hideByDomainList = filters.hideList && [...hiddenDomains].some(h => domain.includes(h));
            
            const isHistoricallyAllowed = historicalAction?.type === 'allow';
            const isHistoricallyBlocked = historicalAction?.type === 'deny';
            
            const isConsideredAllowed = isWhitelisted || isHistoricallyAllowed;
            const isConsideredBlocked = isBlockedByReason || isHistoricallyBlocked;

            let isVisible = true;
            if (filters.hideList && hideByDomainList) isVisible = false;
            if (filters.hideBlocked && isConsideredBlocked) isVisible = false;
            if (filters.showOnlyWhitelisted && !isConsideredAllowed) isVisible = false;
            if (filters.showOnlyBlocked && !(isConsideredBlocked && !isConsideredAllowed)) isVisible = false;

            row.style.display = isVisible ? '' : 'none';
        });
    }

    function observeLogs() {
        const logContainer = document.querySelector('div.logs') || document.body;
        const observer = new MutationObserver(mutationsList => {
            if (mutationsList.some(m => m.type === 'childList' && m.addedNodes.length > 0)) {
                cleanLogs();
            }
        });
        observer.observe(logContainer, { childList: true, subtree: true });
    }

    function startAutoRefresh() {
        if (autoRefreshInterval) return;
        autoRefreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                document.querySelector('.stream-button svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
        }, 5000);
    }

    function stopAutoRefresh() {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }

    function hidePanel() {
        if (panel && !isManuallyLocked) panel.classList.remove('visible');
    }

    async function toggleLock() {
        isManuallyLocked = !isManuallyLocked;
        await storage.set({ [KEY_LOCK_STATE]: isManuallyLocked });
        updateLockIcon();
    }

    function updateLockIcon() {
        if (!lockButton) return;
        while (lockButton.firstChild) lockButton.removeChild(lockButton.firstChild);
        lockButton.appendChild(isManuallyLocked ? icons.locked.cloneNode(true) : icons.unlocked.cloneNode(true));
        if (isManuallyLocked) panel.classList.add('visible');
    }

    function updateTogglePositionIcon() {
        if (!panel || !togglePosButton) return;
        const isLeftSide = panel.classList.contains('left-side');
        while (togglePosButton.firstChild) togglePosButton.removeChild(togglePosButton.firstChild);
        togglePosButton.appendChild(isLeftSide ? icons.arrowRight.cloneNode(true) : icons.arrowLeft.cloneNode(true));
        togglePosButton.title = isLeftSide ? 'Move Panel to Right' : 'Move Panel to Left';
    }

    async function applyPanelPosition() {
        const side = (await storage.get({ [KEY_POSITION_SIDE]: 'left' }))[KEY_POSITION_SIDE];
        const top = (await storage.get({ [KEY_POSITION_TOP]: '10px' }))[KEY_POSITION_TOP];
        panel.style.top = top;
        panel.classList.remove('left-side', 'right-side');
        panel.classList.add(side === 'left' ? 'left-side' : 'right-side');
        leftHeaderControls.innerHTML = '';
        rightHeaderControls.innerHTML = '';
        
        if (side === 'left') {
            leftHeaderControls.appendChild(settingsButton);
            rightHeaderControls.append(togglePosButton, lockButton);
        } else {
            leftHeaderControls.append(lockButton, togglePosButton);
            rightHeaderControls.appendChild(settingsButton);
        }
        updateTogglePositionIcon();
    }
    
    function updatePanelBorderColor() {
        if (!panel) return;
        if (filters.showOnlyBlocked) {
            panel.style.borderColor = 'var(--danger-color)';
        } else if (filters.showOnlyWhitelisted) {
            panel.style.borderColor = 'var(--success-color)';
        } else {
            panel.style.borderColor = 'var(--handle-color)';
        }
    }

    async function toggleFeature(key) {
        const isTurningOn = !filters[key];
        const exclusiveKeys = ['hideBlocked', 'showOnlyBlocked', 'showOnlyWhitelisted'];
        
        if (isTurningOn) {
            if (key === 'showOnlyBlocked') filters.hideList = false;
            if (key === 'hideList') filters.showOnlyBlocked = false;
        }
        
        if (exclusiveKeys.includes(key)) {
            if (isTurningOn) {
                exclusiveKeys.forEach(k => { filters[k] = false; });
                filters[key] = true;
            } else {
                filters[key] = false;
            }
        } else {
            filters[key] = isTurningOn;
        }

        if (key === 'autoRefresh') {
            if (isTurningOn) {
                document.querySelector('.stream-button svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        }

        await storage.set({ [KEY_FILTER_STATE]: filters });
        updateButtonStates();
        updatePanelBorderColor();
        cleanLogs();

        if (/\/denylist|\/allowlist/.test(location.href)) {
            location.reload();
        }
    }

    function updateButtonStates() {
        Object.keys(filters).forEach(k => {
            const btn = document.getElementById(`toggle-${k}`);
            if (btn) {
                btn.classList.toggle('active', filters[k]);
                if (k === 'autoRefresh') {
                    btn.classList.toggle('auto-refresh-active', filters[k]);
                    // --- JS Tweak START: This logic correctly toggles the class on the stream button ---
                    document.querySelector('.stream-button')?.classList.toggle('auto-refresh-active', filters[k]);
                    // --- JS Tweak END ---
                }
            }
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-ndns-theme', theme);
        currentTheme = theme;
    }

    function applyCompactMode(enabled) {
        document.documentElement.classList.toggle('ndns-compact-mode', enabled);
        isCompactMode = enabled;
    }

    function applyPanelWidth(width) {
        panel.style.minWidth = `${width}px`;
        panelWidth = width;
    }

    function createAllowlistToggles(container) {
        const createToggle = (id, labelText, optionKey, isExclusive) => {
            const el = document.createElement('div');
            el.className = 'custom-switch';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = id;
            checkbox.checked = allowDenyOptions[optionKey];
            checkbox.onchange = async (e) => {
                const isChecked = e.target.checked;
                if (isChecked && isExclusive) {
                    ['sortAZ', 'sortTLD', 'sortRoot'].forEach(k => {
                        if (k !== optionKey) {
                           allowDenyOptions[k] = false;
                           const otherCheckbox = document.getElementById(`ndns-toggle-${k}`);
                           if (otherCheckbox) otherCheckbox.checked = false;
                        }
                    });
                }
                allowDenyOptions[optionKey] = isChecked;
                await storage.set({ [KEY_ALLOWDENY_OPTIONS]: allowDenyOptions });
                initAllowDenyListPage();
            };
            const label = document.createElement('label');
            label.htmlFor = id;
            label.textContent = labelText;
            el.append(checkbox, label);
            return el;
        };
        container.appendChild(createToggle('ndns-toggle-boldRoot', 'Bold Root Domain', 'boldRoot', false));
        container.appendChild(createToggle('ndns-toggle-lightenSubdomain', 'Lighten Subdomains', 'lightenSubdomain', false));
        container.appendChild(createToggle('ndns-toggle-sortAZ', 'Sort A-Z', 'sortAZ', true));
        container.appendChild(createToggle('ndns-toggle-sortTLD', 'Sort by TLD', 'sortTLD', true));
        container.appendChild(createToggle('ndns-toggle-sortRoot', 'Sort by Root Domain', 'sortRoot', true));
    }

    async function exportProfile() {
        const pid = getCurrentProfileId();
        if (!pid || !NDNS_API_KEY) {
            showToast("Profile ID or API Key missing. Cannot export.", true);
            return;
        }
        const exportButton = document.getElementById('ndns-export-profile-btn');
        exportButton.disabled = true;
        exportButton.textContent = 'Exporting...';
        const pages = ["security", "privacy", "parentalcontrol", "denylist", "allowlist", "settings", "rewrites"];
        const config = {};
        try {
            const requests = pages.map(page => makeApiRequest('GET', `/profiles/${pid}`, null, NDNS_API_KEY));
            const results = await Promise.all(requests);
            results.forEach((result, index) => {
                config[pages[index]] = result.data;
            });
            if (config.privacy && config.privacy.blocklists) {
                config.privacy.blocklists = config.privacy.blocklists.map(e => ({ id: e.id }));
            }
            if (config.rewrites) {
                config.rewrites = config.rewrites.map(e => ({ name: e.name, content: e.content }));
            }
            if (config.parentalcontrol && config.parentalcontrol.services) {
                config.parentalcontrol.services = config.parentalcontrol.services.map(e => ({ id: e.id, active: e.active, recreation: e.recreation }));
            }
            const content = JSON.stringify(config, null, 2);
            downloadFile(content, `NextDNS-Profile-${pid}-Export.json`, 'application/json');
            showToast("Profile exported successfully!");
        } catch (error) {
            showToast(`Profile export failed: ${error.message}`, true);
        } finally {
            exportButton.disabled = false;
            exportButton.textContent = 'Export Full Profile';
        }
    }

    function buildSettingsModal() {
        const overlay = document.createElement('div');
        overlay.className = 'ndns-settings-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };
        const content = document.createElement('div');
        content.className = 'ndns-settings-modal-content';
        overlay.appendChild(content);

        const header = document.createElement('div');
        header.className = 'ndns-settings-modal-header';
        header.innerHTML = `<h3>Settings</h3>`;
        
        const githubLink = document.createElement('a');
        githubLink.href = 'https://github.com/SysAdminDoc';
        githubLink.target = '_blank';
        githubLink.className = 'github-link';
        githubLink.innerHTML = `${icons.github.outerHTML} <span>Proudly open source</span>`;
        header.appendChild(githubLink);
        
        content.append(header);
        content.innerHTML += `<button class="ndns-settings-close-btn">&times;</button>`;
        content.querySelector('.ndns-settings-close-btn').onclick = () => overlay.style.display = 'none';
        
        const apiKeySection = document.createElement('div');
        apiKeySection.className = 'ndns-settings-section';
        apiKeySection.innerHTML = `<label>API Key</label>`;
        const apiKeyControls = document.createElement('div');
        apiKeyControls.className = 'ndns-settings-controls';
        
        const reminder = document.createElement('p');
        reminder.textContent = 'If you skipped automatic setup, you can paste your API key here at any time to activate full features.';
        reminder.style.fontSize = '12px';
        reminder.style.opacity = '0.7';
        apiKeyControls.appendChild(reminder);

        const apiKeyWrapper = document.createElement('div');
        apiKeyWrapper.className = 'api-key-wrapper';

        const apiKeyInput = document.createElement('input');
        apiKeyInput.type = 'password';
        apiKeyInput.className = 'ndns-panel-button';
        apiKeyInput.style.textAlign = 'left';
        apiKeyInput.placeholder = 'Paste your API key here';
        apiKeyInput.value = NDNS_API_KEY || '';

        const visibilityToggle = document.createElement('button');
        visibilityToggle.className = 'api-key-toggle-visibility';
        visibilityToggle.title = 'Toggle visibility';
        visibilityToggle.appendChild(icons.eye.cloneNode(true));
        visibilityToggle.onclick = () => {
            const isPassword = apiKeyInput.type === 'password';
            apiKeyInput.type = isPassword ? 'text' : 'password';
            visibilityToggle.innerHTML = '';
            visibilityToggle.appendChild(isPassword ? icons.eyeSlash.cloneNode(true) : icons.eye.cloneNode(true));
        };

        apiKeyWrapper.append(apiKeyInput, visibilityToggle);

        const apiKeyLink = document.createElement('a');
        apiKeyLink.href = 'https://my.nextdns.io/account';
        apiKeyLink.target = '_blank';
        apiKeyLink.textContent = 'Get API Key from NextDNS Account Page';
        apiKeyLink.className = 'ndns-panel-button';
        apiKeyLink.style.display = 'block';
        apiKeyLink.style.textAlign = 'center';
        apiKeyLink.style.textDecoration = 'none';
        
        const apiKeySaveBtn = document.createElement('button');
        apiKeySaveBtn.id = 'ndns-settings-save-api-key-btn';
        apiKeySaveBtn.textContent = 'Set/Update API Key';
        apiKeySaveBtn.className = 'ndns-panel-button';
        apiKeySaveBtn.onclick = async () => {
            const newKey = apiKeyInput.value.trim();
            if (newKey) {
                await storage.set({ [KEY_API_KEY]: newKey });
                NDNS_API_KEY = newKey;
                const profileId = getCurrentProfileId();
                if (profileId) {
                    sessionStorage.setItem('ndns_needs_refresh', 'true');
                    window.location.href = `https://my.nextdns.io/${profileId}/logs`;
                } else {
                    showToast('API Key set. Please navigate to a logs page to see changes.', false);
                }
            } else {
                showToast('API Key cannot be empty.', true);
            }
        };

        apiKeyControls.append(apiKeyWrapper, apiKeyLink, apiKeySaveBtn);
        apiKeySection.appendChild(apiKeyControls);
        content.appendChild(apiKeySection);

        const themeSection = document.createElement('div');
        themeSection.className = 'ndns-settings-section';
        themeSection.innerHTML = `<label>Appearance</label>`;
        const themeControls = document.createElement('div');
        themeControls.className = 'ndns-settings-controls';

        const themeRow = document.createElement('div');
        themeRow.className = 'settings-control-row';
        themeRow.innerHTML = `<span>Theme</span>`;
        const themeBtnGroup = document.createElement('div');
        themeBtnGroup.className = 'btn-group';
        const lightBtn = document.createElement('button');
        lightBtn.textContent = 'Light';
        lightBtn.className = 'ndns-panel-button';
        if(currentTheme === 'light') lightBtn.classList.add('active');
        lightBtn.onclick = async () => {
            applyTheme('light');
            await storage.set({ [KEY_THEME]: 'light' });
            themeBtnGroup.querySelector('.active')?.classList.remove('active');
            lightBtn.classList.add('active');
        };
        const darkBtn = document.createElement('button');
        darkBtn.textContent = 'Dark';
        darkBtn.className = 'ndns-panel-button';
        if(currentTheme === 'dark') darkBtn.classList.add('active');
        darkBtn.onclick = async () => {
            applyTheme('dark');
            await storage.set({ [KEY_THEME]: 'dark' });
            themeBtnGroup.querySelector('.active')?.classList.remove('active');
            darkBtn.classList.add('active');
        };
        themeBtnGroup.append(lightBtn, darkBtn);
        themeRow.appendChild(themeBtnGroup);
        themeControls.appendChild(themeRow);

        const widthRow = document.createElement('div');
        widthRow.className = 'settings-control-row';
        const widthLabel = document.createElement('span');
        widthLabel.textContent = `Panel Width: ${panelWidth}px`;
        const widthSlider = document.createElement('input');
        widthSlider.type = 'range';
        widthSlider.min = 200;
        widthSlider.max = 600;
        widthSlider.value = panelWidth;
        widthSlider.style.flexGrow = '1';
        widthSlider.style.marginLeft = '10px';
        widthSlider.oninput = () => {
            const newWidth = widthSlider.value;
            applyPanelWidth(newWidth);
            widthLabel.textContent = `Panel Width: ${newWidth}px`;
        };
        widthSlider.onchange = async () => {
            await storage.set({ [KEY_WIDTH]: widthSlider.value });
        };
        widthRow.append(widthLabel, widthSlider);
        themeControls.appendChild(widthRow);
        
        const compactRow = document.createElement('div');
        compactRow.className = 'settings-control-row';
        compactRow.innerHTML = `<label for="ndns-compact-toggle">Compact Mode</label>`;
        const compactSwitch = document.createElement('div');
        compactSwitch.className = 'custom-switch';
        const compactInput = document.createElement('input');
        compactInput.type = 'checkbox';
        compactInput.id = 'ndns-compact-toggle';
        compactInput.checked = isCompactMode;
        compactInput.onchange = async (e) => {
            applyCompactMode(e.target.checked);
            await storage.set({ [KEY_COMPACT_MODE]: e.target.checked });
        };
        compactSwitch.appendChild(compactInput);
        compactRow.appendChild(compactSwitch);
        themeControls.appendChild(compactRow);

        themeSection.appendChild(themeControls);
        content.appendChild(themeSection);
        
        const dataSection = document.createElement('div');
        dataSection.className = 'ndns-settings-section';
        dataSection.innerHTML = `<label>Data Management</label>`;
        const dataControls = document.createElement('div');
        dataControls.className = 'ndns-settings-controls';

        const exportHostsBtn = document.createElement('button');
        exportHostsBtn.id = 'export-hosts-btn';
        exportHostsBtn.className = 'ndns-panel-button';
        exportHostsBtn.innerHTML = `<span>Export Blocked as HOSTS</span><div class="spinner"></div>`;
        exportHostsBtn.onclick = onDownloadBlockedHosts;
        
        const importBtn = document.createElement('button');
        importBtn.textContent = 'Import Hidden List';
        importBtn.className = 'ndns-panel-button';
        importBtn.onclick = async () => {
            const txt = prompt('Paste JSON hidden list:');
            if (txt) try {
                JSON.parse(txt).forEach(d => hiddenDomains.add(d));
                await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
                showToast('Hidden list imported.');
            } catch { alert('Invalid JSON'); }
        };
        const exportBtn = document.createElement('button');
        exportBtn.textContent = 'Export Hidden List';
        exportBtn.className = 'ndns-panel-button';
        exportBtn.onclick = () => {
            const content = JSON.stringify([...hiddenDomains], null, 2);
            downloadFile(content, 'hidden_domains_list.json', 'application/json');
        };
        const exportProfileBtn = document.createElement('button');
        exportProfileBtn.id = 'ndns-export-profile-btn';
        exportProfileBtn.textContent = 'Export Full Profile';
        exportProfileBtn.className = 'ndns-panel-button';
        exportProfileBtn.onclick = exportProfile;
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear Hidden List';
        clearBtn.className = 'ndns-panel-button danger-button';
        clearBtn.style.marginTop = '10px';
        clearBtn.onclick = async () => {
            const success = await clearHiddenDomains();
            if (success) {
                overlay.style.display = 'none';
            }
        };
        dataControls.append(exportHostsBtn, importBtn, exportBtn, exportProfileBtn, clearBtn);
        dataSection.appendChild(dataControls);
        content.appendChild(dataSection);
        return overlay;
    }

    async function createPanel() {
        if (document.getElementById('ndns-panel-main')) return;
        panel = document.createElement('div');
        panel.id = 'ndns-panel-main';
        panel.className = 'ndns-panel';
        
        applyPanelWidth(panelWidth);
        panel.addEventListener('mouseenter', () => panel.classList.add('visible'));
        panel.addEventListener('mouseleave', hidePanel);
        const header = document.createElement('div');
        header.className = 'ndns-panel-header';
        leftHeaderControls = document.createElement('div');
        leftHeaderControls.className = 'panel-header-controls';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'ndns-header-title';
        titleSpan.textContent = 'NDNS CPanel';
        rightHeaderControls = document.createElement('div');
        rightHeaderControls.className = 'panel-header-controls';
        header.append(leftHeaderControls, titleSpan, rightHeaderControls);
        panel.appendChild(header);
        settingsButton = document.createElement('button');
        settingsButton.title = 'Settings';
        settingsButton.appendChild(icons.settings.cloneNode(true));
        settingsButton.onclick = () => { if (settingsModal) settingsModal.style.display = 'flex'; };
        togglePosButton = document.createElement('button');
        togglePosButton.onclick = async () => {
            const currentSide = panel.classList.contains('left-side') ? 'left' : 'right';
            await storage.set({ [KEY_POSITION_SIDE]: (currentSide === 'left' ? 'right' : 'left') });
            await applyPanelPosition();
        };
        lockButton = document.createElement('button');
        lockButton.title = 'Lock/Unlock Panel';
        lockButton.onclick = toggleLock;
        const content = document.createElement('div');
        content.className = 'ndns-panel-content';
        panel.appendChild(content);
        [
            { key: 'hideList',          label: 'Hide Hidden' },
            { key: 'hideBlocked',       label: 'Hide Blocked' },
            { key: 'showOnlyBlocked',   label: 'Show Blocked' },
            { key: 'showOnlyWhitelisted',label: 'Show Allowed' },
            { key: 'autoRefresh',       label: 'Auto Refresh (5s)' }
        ].forEach(({ key, label }) => {
            const b = document.createElement('button');
            b.id = `toggle-${key}`;
            b.textContent = label;
            b.className = 'ndns-panel-button';
            b.onclick = () => toggleFeature(key);
            content.appendChild(b);
        });
        const preloadContainer = document.createElement('div');
        preloadContainer.className = 'preload-container';
        const select = document.createElement('select');
        [5, 10, 15, 20, 30, 40, 50].forEach(num => select.add(new Option(num)));
        const preloadBtn = document.createElement('button');
        preloadBtn.id = 'preload-btn';
        preloadBtn.textContent = 'Preload';
        preloadBtn.className = 'ndns-panel-button';
        preloadBtn.onclick = () => autoScrollLog(parseInt(select.value, 10));
        preloadContainer.append(select, preloadBtn);
        content.appendChild(preloadContainer);
        if (/\/denylist|\/allowlist/.test(location.href)) {
            content.appendChild(document.createElement('div')).className = 'ndns-divider';
            const details = document.createElement('details');
            details.className = 'ndns-collapsible-section';
            const summary = document.createElement('summary');
            summary.textContent = 'Allow/Deny Page Options';
            details.appendChild(summary);
            const togglesContainer = document.createElement('div');
            togglesContainer.className = 'ndns-collapsible-section-content';
            createAllowlistToggles(togglesContainer);
            details.appendChild(togglesContainer);
            content.appendChild(details);
        }
        document.body.appendChild(panel);
        header.addEventListener('mousedown', function(e) {
            if (e.target.closest('.panel-header-controls')) return;
            let offsetY = e.clientY - panel.getBoundingClientRect().top;
            const mouseMoveHandler = (e) => panel.style.top = (e.clientY - offsetY) + 'px';
            const mouseUpHandler = async () => {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                await storage.set({ [KEY_POSITION_TOP]: panel.style.top });
            };
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });
    }

    function initAllowDenyListPage() {
        const listType = location.pathname.includes('/denylist') ? 'denylist' : 'allowlist';
        const addRemoveButtons = () => {
            document.querySelectorAll(".list-group-item").forEach(item => {
                const domainEl = item.querySelector('.notranslate');
                if (!domainEl || item.querySelector('.remove-list-item-btn')) return;
                
                const domain = domainEl.textContent.trim();
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-list-item-btn';
                removeBtn.title = `Remove from ${listType}`;
                removeBtn.appendChild(icons.remove.cloneNode(true));
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    removeDomainViaApi(domain, listType);
                };
                domainEl.parentNode.insertBefore(removeBtn, domainEl.nextSibling);
            });
        };

        const observer = new MutationObserver(addRemoveButtons);
        const targetNode = document.querySelector('.list-group');
        if (targetNode) {
            addRemoveButtons();
            observer.observe(targetNode, { childList: true, subtree: true });
        }
    }

    function applyDomainStyling() {
        document.querySelectorAll(".list-group-item .notranslate").forEach(item => {
            item.innerHTML = item.textContent;
            const domainName = item.textContent.trim();
            const rootDomain = extractRootDomain(domainName);
            const subdomains = domainName.substring(0, domainName.length - rootDomain.length);
            let styledHTML = '';
            if (allowDenyOptions.lightenSubdomain) {
                styledHTML += `<span class="subdomain">${subdomains}</span>`;
            } else {
                styledHTML += subdomains;
            }
            if (allowDenyOptions.boldRoot) {
                styledHTML += `<strong>${rootDomain}</strong>`;
            } else {
                styledHTML += rootDomain;
            }
            item.innerHTML = styledHTML;
        });
    }

    function applyDomainSorting() {
        if (!allowDenyOptions.sortAZ && !allowDenyOptions.sortTLD && !allowDenyOptions.sortRoot) return;
        const listContainer = document.querySelector(".list-group:not(:first-of-type)");
        if (!listContainer) return;
        const items = Array.from(listContainer.querySelectorAll(".list-group-item"));
        items.sort((a, b) => {
            const domainA = a.querySelector('.notranslate').textContent.trim();
            const domainB = b.querySelector('.notranslate').textContent.trim();
            if (allowDenyOptions.sortRoot) {
                const rootA = extractRootDomain(domainA);
                const rootB = extractRootDomain(domainB);
                if (rootA !== rootB) return rootA.localeCompare(rootB);
            }
            if (allowDenyOptions.sortTLD) {
                return domainA.split('.').reverse().join('.').localeCompare(domainB.split('.').reverse().join('.'));
            }
            return domainA.localeCompare(domainB);
        }).forEach(item => listContainer.appendChild(item));
    }

    // ——— MAIN INITIALIZATION LOGIC ———
    async function main() {
        await initializeState();
        applyTheme(currentTheme);
        applyCompactMode(isCompactMode);

        const isLoggedIn = !document.querySelector('form[action="#submit"]');
        
        const profileIdFromUrl = getProfileID();

        if (profileIdFromUrl) {
            globalProfileId = profileIdFromUrl;
            await storage.set({ [KEY_PROFILE_ID]: profileIdFromUrl });
        }

        if (!isLoggedIn) {
            if (location.pathname === '/login' || location.pathname === '/signup') {
                createLoginSpotlight();
            } else if (location.pathname === '/') {
                window.location.href = 'https://my.nextdns.io/login';
            }
            return;
        }

        if (location.pathname.includes('/account')) {
            handleAccountPage();
            return;
        }
        
        if (sessionStorage.getItem('ndns_needs_refresh')) {
            sessionStorage.removeItem('ndns_needs_refresh');
            location.reload();
        }

        if (globalProfileId) {
            sessionStorage.setItem('ndns_profile_id', globalProfileId);
            await createPanel();
            settingsModal = buildSettingsModal();
            document.body.appendChild(settingsModal);

            const returnFlag = await storage.get(['ndns_return_from_account']);
            if (returnFlag.ndns_return_from_account) {
                await finalizeApiKeySetup();
                return; 
            }

            if (!NDNS_API_KEY) {
                showOnboardingModal();
                return;
            }

            await applyPanelPosition();
            updateButtonStates();
            updateLockIcon();
            updatePanelBorderColor();

            if (filters.autoRefresh) startAutoRefresh();

            if (/\/logs/.test(location.href)) {
                const initialLogCheck = () => {
                    if (document.querySelector('div.list-group-item.log')) {
                        cleanLogs();
                        observeLogs();
                        return true;
                    }
                    return false;
                };
                if (!initialLogCheck()) {
                    const observer = new MutationObserver(() => {
                        if (initialLogCheck()) {
                            observer.disconnect();
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                }
            }
            
            if (/\/denylist|\/allowlist/.test(location.href)) {
                 initAllowDenyListPage();
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();