/**
 * Shared UI Utility
 * Handles theme management and status indicator updates across the application.
 */
const UI = {
    /**
     * Updates the status dot and text in the header.
     * @param {string} type - 'online', 'testing', 'error', 'offline'
     * @param {string} msg - The message to display
     * @param {string} onlineColor - Optional custom color class for 'online' status
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
        const isDark = localStorage.getItem('theme') === 'dark' || 
                      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
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
    }
};