/**
 * Shared GitHub API Utility
 * Serves as the persistence layer, using GitHub Contents API as a serverless JSON database.
 */
const GITHUB = {
    /**
     * Fetches a JSON file from GitHub and decodes its content.
     * Handles the complex Base64-to-UTF8 decoding required for multi-byte characters.
     * @param {string} repo - Repository path (e.g., 'user/repo')
     * @param {string} path - Filename path in repo
     * @param {string} token - Personal Access Token
     * @returns {Object} { content: Array/Object, sha: String }
     */
    async fetchFile(repo, path, token) {
        const headers = {};
        if (token && token.trim() !== '' && token !== 'no-token') {
            headers['Authorization'] = `token ${token}`;
        }

        const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers });
        if (res.ok) {
            const data = await res.json();
            return {
                content: JSON.parse(decodeURIComponent(escape(atob(data.content)))),
                sha: data.sha
            };
        } else if (res.status === 404) {
            // Return empty array if file doesn't exist yet
            return { content: [], sha: null };
        }
        throw new Error(`GitHub API Error: ${res.status}`);
    },

    /**
     * Encodes content to Base64 and saves/updates the file on GitHub.
     * Implements Optimistic Locking by requiring the existing SHA.
     * @param {string} repo - Repository path
     * @param {string} path - Target filename
     * @param {string} token - Auth token
     * @param {Object} content - Data to save
     * @param {string} message - Commit message
     * @param {string} sha - The current file SHA (to authorize updates)
     */
    async saveFile(repo, path, token, content, message, sha) {
        const body = {
            message: message,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
            sha: sha
        };
        const headers = { 'Content-Type': 'application/json' };
        if (token && token.trim() !== '' && token !== 'no-token') {
            headers['Authorization'] = `token ${token}`;
        }

        const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`GitHub API Error: ${res.status}`);
        return await res.json();
    }
};