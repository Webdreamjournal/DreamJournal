// Applies the saved theme before first paint to avoid a flash of the wrong theme.
// Kept as an external file so the page can use a CSP without 'unsafe-inline' scripts.
(function () {
    try {
        var theme = localStorage.getItem('dreamJournalTheme') || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {
        // localStorage can be unavailable (e.g. private browsing); fall back to CSS default
    }
})();
