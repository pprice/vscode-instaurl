// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as Instaurl from 'instaurl';
import * as ncp from 'copy-paste';

class VsCodeInstaurl {

    static MaxSize: number = 10 * 1024;

    private createDestinations: { [key: string]: (payload) => void } = {
        'clipboard': (payload) => {
            let url = payload.webUrl;

            return ncp.copy(url, () => {
                vscode.window.showInformationMessage('instaurl copied to clipboard!');
            });
        }
    }

    private createSources: { [key: string]: (editor: vscode.TextEditor) => string } = {
        'document': (editor) => {
            return editor.document.getText();
        },
        'selection': (editor) => {
            if (!editor.selection.isEmpty) {
                return editor.document.getText(editor.selection);
            }

            return editor.document.getText();
        }
    }

    private editSources: { [key: string]: (callback) => void } = {
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

    private editDestinations: { [key: string]: (editor: vscode.TextEditor, content) => Thenable<boolean> } = {
        'document': (editor, content) => {
            const document = editor.document;

            return editor.edit((editBuilder) => {
                const start = new vscode.Position(0, 0);
                const lastLine = document.lineCount - 1;
                const end = document.lineAt(lastLine).range.end;
                const range = new vscode.Range(start, end);

                editBuilder.replace(range, content) // TODO
            });
        },
        'selection': (editor, content) => {
            const document = editor.document;

            // Insert
            if (editor.selection.isEmpty) {
                return editor.edit((edit) => {
                    edit.insert(editor.selection.start, content);
                })
            }

            // Replace
            return editor.edit((edit) => {
                edit.replace(editor.selection, content);
            })
        }
    }

    private instaurl = null;

    constructor(token) {
        this.instaurl = new Instaurl({ token: token });
    }

    create(from, to) {
        let fromExec = this.createSources[from];
        let toExec = this.createDestinations[to];

        if (!fromExec || !toExec) { return; }

        let buffer = fromExec(vscode.window.activeTextEditor);

        if (!buffer) { return; }

        if (buffer.length > VsCodeInstaurl.MaxSize) {
            vscode.window.showErrorMessage('Current document is too big')
            return;
        }

        this.instaurl.set(buffer, (err, res) => {
            if (err) {
                return vscode.window.showErrorMessage('Oops! Failed to create instaurl, server returned an error');
            }

            toExec(res);
        });
    }

    edit(from, to) {
        let fromExec = this.editSources[from];
        let toExec = this.editDestinations[to];

        if (!fromExec || !toExec) {
            return;
        }

        fromExec((err: Error, key: string) => {
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
                } catch (e) { }

                toExec(vscode.window.activeTextEditor, secret);
            });
        });
    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    const publicToken = 'Ngb1yfg!gbakeIgbE3!ngjqugBhHgfqe';
    const token = vscode.workspace.getConfiguration('instaurl').get('token') || publicToken;
    const codeInstaUrl = new VsCodeInstaurl(token);

    var createDocument = vscode.commands.registerCommand(
        'instaurl.create.document',
        () => codeInstaUrl.create('document', 'clipboard'));

    var createSelection = vscode.commands.registerCommand(
        'instaurl.create.selection',
        () => codeInstaUrl.create('selection', 'clipboard'));

    var replace = vscode.commands.registerCommand(
        'instaurl.replace',
        () => codeInstaUrl.edit('clipboard', 'document'));

    var insert = vscode.commands.registerCommand(
        'instaurl.insert',
        () => codeInstaUrl.edit('clipboard', 'selection'));

    context.subscriptions.push(createDocument);
    context.subscriptions.push(createSelection);
    context.subscriptions.push(replace);
    context.subscriptions.push(insert);
}