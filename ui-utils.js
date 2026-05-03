/**
 * Shared UI Utility
 * Global interface helpers for connection states, visual themes, and security sanitization.
 */
const UI = {
    /**
     * Provides real-time feedback on the database connection status.
     * @param {'online'|'testing'|'error'|'offline'} type - State type
     * @param {string} msg - User-friendly message
     * @param {string} [onlineColor='bg-blue-500'] - Theme-specific color for the online state
     */
    updateStatus(type, msg, onlineColor = 'bg-blue-500') {
        const dot = document.getElementById('status-dot');
        const txt = document.getElementById('status-text');
        if (!dot || !txt) return;

        const colors = { 
            online: `${onlineColor} animate-pulse`, 
            testing: 'bg-amber-500 animate-bounce', 
            error: 'bg-rose-600', 
            offline: 'bg-slate-600' 
        };
        dot.className = `w-1.5 h-1.5 rounded-full mr-2 ${colors[type] || colors.offline}`;
        txt.innerText = msg;
    },

    /**
     * Applies the saved theme from localStorage or system preference.
     */
    applyTheme() {
        const isDark = localStorage.getItem('theme') !== 'light';
        document.documentElement.classList.toggle('dark', isDark);
        const icon = document.getElementById('theme-icon');
        if (icon) icon.innerText = isDark ? '☀️' : '🌙';
    },

    /**
     * Toggles between light and dark mode and saves preference.
     */
    toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        const icon = document.getElementById('theme-icon');
        if (icon) icon.innerText = isDark ? '☀️' : '🌙';
    },

    /**
     * Escapes HTML characters to prevent XSS attacks when rendering user-generated content.
     * @param {string} str - Raw input string
     * @returns {string} - Sanitized string
     */
    escapeHTML(str) {
        if (!str) return "";
        return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    }
};