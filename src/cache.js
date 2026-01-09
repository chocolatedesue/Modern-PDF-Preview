const vscode = require("vscode");
import Logger from "./logger.js";

/**
 * LRU Cache Manager for PDF documents
 * Limits memory usage by evicting least recently used entries
 */
class PDFCacheManager {
    constructor(maxSize = 3) {
        this.cache = new Map(); // uri -> {data, lastAccess, size}
        this.maxSize = maxSize;
    }

    /**
     * Get cached data for a URI
     * @param {vscode.Uri} uri
     * @returns {Uint8Array|null} Raw data or null if not cached
     */
    get(uri) {
        const key = uri.toString();
        const entry = this.cache.get(key);
        if (entry) {
            // Move to end of Map to maintain LRU order (most recently used)
            this.cache.delete(key);
            entry.lastAccess = Date.now();
            this.cache.set(key, entry);

            Logger.log(`Cache hit for ${uri.fsPath}`);
            return entry.data;
        }
        Logger.log(`Cache miss for ${uri.fsPath}`);
        return null;
    }

    /**
     * Set cached data for a URI
     * @param {vscode.Uri} uri
     * @param {Uint8Array} data Raw binary data
     * @param {number} size Original file size in bytes
     */
    set(uri, data, size) {
        const key = uri.toString();

        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Map.keys().next().value gets the first (oldest) key in O(1)
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
            Logger.log(`Cache evicted: ${oldestKey} (LRU policy)`);
        }

        this.cache.set(key, {
            data,
            lastAccess: Date.now(),
            size
        });

        Logger.log(`Cache stored: ${uri.fsPath} (${this.cache.size}/${this.maxSize})`);
    }

    /**
     * Check if URI is cached
     * @param {vscode.Uri} uri 
     * @returns {boolean}
     */
    has(uri) {
        return this.cache.has(uri.toString());
    }

    /**
     * Clear all cached entries
     */
    clear() {
        const count = this.cache.size;
        this.cache.clear();
        Logger.log(`Cache cleared: ${count} entries removed`);
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getStats() {
        let totalSize = 0;
        const entryKeys = [];
        for (const [key, entry] of this.cache.entries()) {
            totalSize += entry.size;
            entryKeys.push(key);
        }
        return {
            count: this.cache.size,
            maxSize: this.maxSize,
            totalSize,
            entries: entryKeys
        };
    }
}

export default PDFCacheManager;
