const vscode = require("vscode");

class Logger {
    static _channel = null;

    static get channel() {
        if (!this._channel) {
            this._channel = vscode.window.createOutputChannel("Modern PDF Pro");
        }
        return this._channel;
    }

    static log(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.channel.appendLine(`[${timestamp}] ${message}`);
    }

    static show() {
        this.channel.show(true);
    }
}

export default Logger;
