// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as Instaurl from 'instaurl';
import * as ncp from 'copy-paste';

class VsCodeInstaurl {

    static MaxSize: number = 10 * 1024;

    private targets: { [key: string]: (payload) => void } = {
        'clipboard': (payload) => {
            let url = payload.webUrl;

            return ncp.copy(url, () => {
                vscode.window.showInformationMessage('instaurl copied to clipboard!');
            });
        }
    }

    private sources: { [key: string]: (callback) => void } = {
        'clipboard': (callback) => {
            ncp.paste((err, result) => {
                if (err || typeof result !== 'string') {
                    return vscode.window.showInformationMessage('Failed to get clipboard contents');
                }

                let lowercaseResult = result.toLowerCase();
                if (lowercaseResult.indexOf('https://www.instaurl.com') !== 0 || (lowercaseResult.indexOf('/i/') === -1 && lowercaseResult.indexOf('/v1.0/url/') === -1)) {
                    return vscode.window.showInformationMessage(`Not a instaurl in the clipboard`);
                }

                // parse out the key
                let key = result.split('/').pop();
                return callback(null, key);
            });
        }
    }

    private instaurl = null;

    constructor(token) {
        this.instaurl = new Instaurl({ token: token });
    }

    createFromActive(target) {
        let buffer = this.getActiveBuffer();

        if (!buffer) {
            return;
        }

        let targetExec = this.targets[target];

        if (!targetExec) {
            return;
        }

        this.instaurl.set(buffer, (err, res) => {
            if (err) {
                return vscode.window.showErrorMessage('Oops! Failed to create instaurl, server returned an error');
            }

            targetExec(res);
        })
    }

    replaceActiveFrom(target) {
        let sourceExec = this.sources[target];

        if (!sourceExec) {
            return;
        }

        sourceExec((err: Error, key: string) => {
            if (err) {
                return vscode.window.showErrorMessage('instaurl: ' + (err.message || err.name || 'Unknown error'));
            }

            this.instaurl.get(key, (err, res) => {
                if (err) {
                    return vscode.window.showErrorMessage('instaurl: ' + (err.message || ('Got an error status code: ' + err.statusCode) || 'Unknown'));
                }
                else if (!res || !res.secret) {
                    return vscode.window.showErrorMessage('instaurl: Got an empty response!');
                }

                let secret = res.secret;

                try {
                    secret = JSON.parse('"' + res.secret + '"');
                } catch(e) { }

                const editor = vscode.window.activeTextEditor;
                const document = editor.document;

                vscode.window.activeTextEditor.edit((editBuilder) => {
                    const start = new vscode.Position(0, 0);
                    const lastLine = document.lineCount - 1;
                    const end = document.lineAt(lastLine).range.end;
                    const range = new vscode.Range(start, end);

                    editBuilder.replace(range, secret) // TODO
                }).then((res) => {
                    return vscode.window.showInformationMessage('instaurl: Document replaced :-)');
                });
            });


        });
    }

    private getActiveBuffer() {
        let buffer = vscode.window.activeTextEditor.document.getText();

        if (buffer.length > VsCodeInstaurl.MaxSize) {
            vscode.window.showErrorMessage('Current document is too big')
            return;
        }

        return buffer;
    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    const publicToken = 'Ngb1yfg!gbakeIgbE3!ngjqugBhHgfqe';
    const token = vscode.workspace.getConfiguration('instaurl').get('token') || publicToken;
    const codeInstaUrl = new VsCodeInstaurl(token);

    var createClipboard = vscode.commands.registerCommand(
        'instaurl.create.current.clipboard',
        () => codeInstaUrl.createFromActive('clipboard'));

    var fromClipboard = vscode.commands.registerCommand(
        'instaurl.from.current.clipboard',
        () => codeInstaUrl.replaceActiveFrom('clipboard'));

    context.subscriptions.push(createClipboard);
    context.subscriptions.push(fromClipboard);
}