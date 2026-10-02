// ================================
// DIALOG FOCUS MANAGEMENT
// ================================
// The app shows modal dialogs as overlay elements (`.pin-overlay`, `.security-dialog-overlay`)
// that are created or shown by many different modules. Rather than adding focus handling to
// each of them, this module watches for overlays becoming visible and gives them the
// behaviour a modal dialog needs:
//   - role="dialog", aria-modal and an accessible name (when the overlay does not set them)
//   - focus moves into the dialog when it opens and returns to the opener when it closes
//   - Tab and Shift+Tab stay inside the dialog
//   - the page behind the dialog is made inert (not focusable, hidden from assistive technology)
//   - Escape presses the dialog's cancel/close/OK button, if it has one

const OVERLAY_SELECTOR = '.pin-overlay, .security-dialog-overlay';
const BACKGROUND_SELECTOR = '.container';
const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

// Button texts that mean "dismiss this dialog without doing anything else"
const DISMISS_TEXT = /^(cancel|close|ok|no\b|dismiss|back|not now|got it|keep\b)/i;

let currentOverlay = null;
let opener = null;
let lastFocusedOutside = null; // last element focused outside any dialog
let titleCounter = 0;
let started = false;

function isVisible(element) {
    return element.isConnected
        && getComputedStyle(element).display !== 'none'
        && element.getClientRects().length > 0;
}

/** The visible overlay that was added last, which is the one drawn on top. */
function getTopOverlay() {
    const visible = [...document.querySelectorAll(OVERLAY_SELECTOR)].filter(isVisible);
    return visible.length ? visible[visible.length - 1] : null;
}

function getFocusable(overlay) {
    return [...overlay.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isVisible);
}

/** Adds dialog semantics the overlay does not already have. */
function describeAsDialog(overlay) {
    if (!overlay.hasAttribute('role')) overlay.setAttribute('role', 'dialog');
    if (!overlay.hasAttribute('aria-modal')) overlay.setAttribute('aria-modal', 'true');
    if (!overlay.hasAttribute('aria-labelledby') && !overlay.hasAttribute('aria-label')) {
        const title = overlay.querySelector('h1, h2, h3');
        if (title) {
            if (!title.id) title.id = `dialog-title-${++titleCounter}`;
            overlay.setAttribute('aria-labelledby', title.id);
        }
    }
}

/** Moves focus to the first input, else the first control, else the overlay itself. */
function focusInside(overlay) {
    const focusable = getFocusable(overlay);
    const target = focusable.find(el => el.matches('input, select, textarea')) || focusable[0];
    if (target) {
        target.focus();
    } else {
        // Dialogs with no controls (progress dialogs) still take focus so the keyboard is not left behind them
        overlay.setAttribute('tabindex', '-1');
        overlay.focus();
    }
}

function setBackgroundInert(inert) {
    document.querySelectorAll(BACKGROUND_SELECTOR).forEach(el => { el.inert = inert; });
}

/** Brings the dialog state in line with which overlay, if any, is on top. */
function syncDialogState() {
    const top = getTopOverlay();

    if (top === currentOverlay) {
        // Same dialog, but its content may have been replaced while it was open
        if (top && !top.contains(document.activeElement)) focusInside(top);
        return;
    }

    if (top) {
        if (!currentOverlay) {
            // By the time the dialog is detected, the code that opened it has usually moved focus into
            // it or disabled the opener, so use the last element that had focus outside a dialog
            opener = lastFocusedOutside;
        }
        describeAsDialog(top);
        setBackgroundInert(true);
        currentOverlay = top;
        focusInside(top);
    } else {
        setBackgroundInert(false);
        currentOverlay = null;
        const previous = opener;
        opener = null;
        if (previous) restoreFocus(previous);
    }
}

/**
 * Returns focus to the element that opened the dialog. Handlers often re-enable their
 * controls just after the dialog closes, and a disabled button cannot take focus, so a
 * failed attempt is retried once. Focus is left alone if something else has taken it.
 */
function restoreFocus(opening) {
    // Handlers sometimes re-render their section, replacing the opener; look for its replacement
    const find = () => {
        if (opening.isConnected) return opening;
        if (opening.id) return document.getElementById(opening.id);
        const action = opening.getAttribute('data-action');
        return action ? document.querySelector(`[data-action="${CSS.escape(action)}"]`) : null;
    };
    const attempt = () => {
        const element = find();
        if (!element || !isVisible(element)) return false;
        element.focus();
        return document.activeElement === element;
    };
    if (attempt()) return;
    setTimeout(() => {
        if (currentOverlay) return; // another dialog opened in the meantime
        const active = document.activeElement;
        if (!active || active === document.body) attempt();
    }, 100);
}

/** Presses the dialog's own cancel, close or OK button. Returns true if one was found. */
function dismissOverlay(overlay) {
    const buttons = getFocusable(overlay).filter(el => el.matches('button'));
    const target = buttons.find(el => el.hasAttribute('data-dialog-dismiss'))
        || buttons.find(el => DISMISS_TEXT.test(el.textContent.trim()))
        || (buttons.length === 1 ? buttons[0] : null);
    if (!target) return false;
    target.click();
    return true;
}

function handleKeydown(event) {
    const overlay = currentOverlay && isVisible(currentOverlay) ? currentOverlay : null;
    if (!overlay) return;

    if (event.key === 'Escape') {
        if (dismissOverlay(overlay)) event.preventDefault();
        return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getFocusable(overlay);
    if (focusable.length === 0) {
        event.preventDefault();
        return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (!overlay.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
    }
}

/**
 * Starts watching for dialog overlays. Safe to call more than once.
 * Overlays created by script are appended to <body>; the static PIN overlay is shown by
 * changing its style and has its content replaced, so it is watched in more detail.
 */
function initializeDialogFocus() {
    if (started) return;
    started = true;

    const observer = new MutationObserver(syncDialogState);
    observer.observe(document.body, { childList: true });

    const pinOverlay = document.getElementById('pinOverlay');
    if (pinOverlay) {
        observer.observe(pinOverlay, { attributes: true, attributeFilter: ['style', 'class'], childList: true, subtree: true });
    }

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('focusin', (event) => {
        if (!event.target.closest(OVERLAY_SELECTOR)) lastFocusedOutside = event.target;
    });
    syncDialogState();
}

export { initializeDialogFocus };
