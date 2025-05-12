import * as vscode from 'vscode';
import { findAllPackageJsonFiles, getAllNpmScripts } from './utils/packageJsonFinder';
import { runNpmScript } from './utils/scriptRunner';
import { getWebviewContent, getErrorWebviewContent } from './views/webview';

/**
 * Активация расширения
 * @param context Контекст расширения
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('NPM Scripts Runner is now active!');

  // Create status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = '$(play) NPM Scripts';
  statusBarItem.command = 'npm-scripts-runner.showScripts';
  statusBarItem.tooltip = 'Show NPM Scripts Runner';

  // Check if package.json exists and show the button
  updateStatusBarVisibility(statusBarItem);

  // Update visibility when files change
  const watcher = vscode.workspace.createFileSystemWatcher('**/package.json');
  watcher.onDidCreate(() => updateStatusBarVisibility(statusBarItem));
  watcher.onDidDelete(() => updateStatusBarVisibility(statusBarItem));

  // Update visibility when workspace folders change
  vscode.workspace.onDidChangeWorkspaceFolders(() => updateStatusBarVisibility(statusBarItem));

  // Register the command to show npm scripts
  const disposable = vscode.commands.registerCommand('npm-scripts-runner.showScripts', async () => {
    try {
      const panel = vscode.window.createWebviewPanel(
        'npmScriptsRunner',
        'NPM Scripts Runner',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      await updateWebview(panel);

      // Handle messages from the webview
      panel.webview.onDidReceiveMessage(
        (message) => {
          switch (message.command) {
            case 'runScript':
              runNpmScript(message.script, message.packagePath, message.useSharedTerminal);
              return;
            case 'refresh':
              updateWebview(panel);
              return;
            case 'saveSettings':
              // You could save this to workspace state if needed
              return;
          }
        },
        undefined,
        context.subscriptions
      );

      // Update the webview when package.json changes
      const scriptWatcher = vscode.workspace.createFileSystemWatcher('**/package.json');
      scriptWatcher.onDidChange(() => updateWebview(panel));
      scriptWatcher.onDidCreate(() => updateWebview(panel));
      scriptWatcher.onDidDelete(() => updateWebview(panel));

      context.subscriptions.push(scriptWatcher);
    } catch (error) {
      vscode.window.showErrorMessage(`Error opening NPM Scripts Runner: ${error instanceof Error ? error.message : String(error)}`);
      console.error(error);
    }
  });

  // Add everything to subscriptions
  context.subscriptions.push(disposable, statusBarItem, watcher);
}

/**
 * Update status bar visibility based on whether package.json exists
 * @param statusBarItem Status bar item to update
 */
async function updateStatusBarVisibility(statusBarItem: vscode.StatusBarItem): Promise<void> {
  try {
    const packageFiles = await findAllPackageJsonFiles();
    if (packageFiles.length > 0) {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  } catch (error) {
    console.error(`Error updating status bar visibility: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Update the webview content
 * @param panel Webview panel to update
 */
async function updateWebview(panel: vscode.WebviewPanel): Promise<void> {
  try {
    const packageFiles = await findAllPackageJsonFiles();
    const packageScripts = getAllNpmScripts(packageFiles);
    panel.webview.html = getWebviewContent(packageScripts, panel.webview);
  } catch (error) {
    console.error(`Error updating webview: ${error instanceof Error ? error.message : String(error)}`);
    panel.webview.html = getErrorWebviewContent(error instanceof Error ? error.message : String(error));
  }
}

export function deactivate(): void {}