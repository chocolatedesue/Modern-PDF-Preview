const vscode = require("vscode");
import { OUTPUT_CHANNEL_NAME } from "../constants/index.js";

class Logger {
    static _channel = null;

    static get channel() {
        if (!this._channel) {
            this._channel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
        }
        return this._channel;
    }

    static log(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.channel.appendLine(`[${timestamp}] ${message}`);
    }

    static logPerformance(operation, durationMs, metadata = {}) {
        const metaStr = Object.keys(metadata).length
            ? ` | ${JSON.stringify(metadata)}`
            : '';
        this.log(`[PERF] ${operation}: ${durationMs}ms${metaStr}`);
    }

    static show() {
        this.channel.show(true);
    }
}

export default Logger;

