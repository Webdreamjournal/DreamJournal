/**
 * @fileoverview Page-level banner for storage problems.
 *
 * Shown at the top of the page when the IndexedDB connection is blocked by another tab,
 * was closed because another tab upgraded the database, or could not be opened (the app
 * then keeps data in memory only). It has no imports so that storage.js can use it.
 */

const BANNER_ID = 'storageBanner';

/**
 * Banner content per kind. A banner replaces the current one only when its priority
 * is equal or higher, so the "memory only" message from a later failed save does not
 * hide the "reload" message.
 */
const BANNERS = {
    blocked: {
        priority: 1,
        title: 'Waiting for other Dream Journal tabs to close.',
        text: 'Another tab or window has an older version of the app open and is holding the database. Close the other Dream Journal tabs to continue.',
        reload: false
    },
    updated: {
        priority: 3,
        title: 'Dream Journal was updated in another tab.',
        text: 'This page closed its storage connection so the update could finish. Reload this page to continue; changes made here since may not have been saved.',
        reload: true
    },
    memory: {
        priority: 2,
        title: 'Storage is not available. Nothing you save will be kept.',
        text: 'Dream Journal could not open its database, so entries are held in memory only and will be lost when this page is reloaded or closed. Export anything you want to keep.',
        reload: true
    }
};

/** Shown in place of a save while this tab's database connection is closed. */
const SAVE_REFUSED_MESSAGE = 'The app was updated in another tab, so this could not be saved. Reload the page first. What you typed is still here until you reload, so copy it if you need it.';

let currentKind = null;

/**
 * Shows the storage banner for the given kind unless a banner of higher priority is showing.
 *
 * @param {('blocked'|'updated'|'memory')} kind - Which message to show
 * @returns {void}
 */
function showStorageBanner(kind) {
    const content = BANNERS[kind];
    if (!content || !document.body) return;
    if (currentKind && BANNERS[currentKind].priority > content.priority) return;

    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
        banner = document.createElement('div');
        banner.id = BANNER_ID;
        banner.className = 'storage-banner';
        banner.setAttribute('role', 'alert');
        document.body.insertBefore(banner, document.body.firstChild);
    }
    banner.replaceChildren();
    banner.dataset.kind = kind;

    const message = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = content.title;
    message.append(title, document.createElement('br'), content.text);
    banner.append(message);

    if (content.reload) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-small';
        button.textContent = 'Reload';
        button.addEventListener('click', () => window.location.reload());
        banner.append(button);
    }
    currentKind = kind;
}

/**
 * Removes the banner if it is currently showing the given kind.
 *
 * @param {('blocked'|'updated'|'memory')} kind - Which message to clear
 * @returns {void}
 */
function hideStorageBanner(kind) {
    if (currentKind !== kind) return;
    document.getElementById(BANNER_ID)?.remove();
    currentKind = null;
}

export { showStorageBanner, hideStorageBanner, SAVE_REFUSED_MESSAGE };
