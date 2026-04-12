/**
 * Shared GitHub API Utility
 * Handles all communication with GitHub repository for data persistence.
 */
const GITHUB = {
    /**
     * Fetches a JSON file from GitHub and decodes its content.
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