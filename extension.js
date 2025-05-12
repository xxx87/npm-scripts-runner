const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log("NPM Scripts Runner is now active!");

  // Register the command to show npm scripts
  const disposable = vscode.commands.registerCommand("npm-scripts-runner.showScripts", () => {
    const panel = vscode.window.createWebviewPanel("npmScriptsRunner", "NPM Scripts Runner", vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true
    });

    updateWebview(panel);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "runScript":
            runNpmScript(message.script, message.useSharedTerminal);
            return;
          case "refresh":
            updateWebview(panel);
            return;
          case "saveSettings":
            // You could save this to workspace state if needed
            return;
        }
      },
      undefined,
      context.subscriptions
    );

    // Update the webview when package.json changes
    const watcher = vscode.workspace.createFileSystemWatcher("**/package.json");
    watcher.onDidChange(() => updateWebview(panel));
    watcher.onDidCreate(() => updateWebview(panel));
    watcher.onDidDelete(() => updateWebview(panel));

    context.subscriptions.push(watcher);
  });

  context.subscriptions.push(disposable);

  // Create status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = "$(play) NPM Scripts";
  statusBarItem.command = "npm-scripts-runner.showScripts";
  statusBarItem.tooltip = "Show NPM Scripts Runner";
  statusBarItem.show();

  context.subscriptions.push(statusBarItem);
}

/**
 * Update the webview content
 * @param {vscode.WebviewPanel} panel
 */
function updateWebview(panel) {
  const scripts = getNpmScripts();
  panel.webview.html = getWebviewContent(scripts, panel.webview);
}

/**
 * Get npm scripts from package.json
 * @returns {Object} scripts
 */
function getNpmScripts() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return {};
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const packageJsonPath = path.join(rootPath, "package.json");

  try {
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      return packageJson.scripts || {};
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Error reading package.json: ${error.message}`);
  }

  return {};
}

/**
 * Get or create terminal based on settings
 * @param {string} scriptName
 * @param {boolean} useSharedTerminal
 * @returns {vscode.Terminal}
 */
function getTerminal(scriptName, useSharedTerminal) {
  if (useSharedTerminal) {
    // Use a shared terminal or create one if it doesn't exist
    const terminalName = "NPM Scripts Runner";
    let terminal = vscode.window.terminals.find((t) => t.name === terminalName);
    if (!terminal) {
      terminal = vscode.window.createTerminal(terminalName);
    }
    return terminal;
  } else {
    // Create a new terminal for this script
    return vscode.window.createTerminal(`npm: ${scriptName}`);
  }
}

/**
 * Run an npm script
 * @param {string} scriptName
 * @param {boolean} useSharedTerminal
 */
function runNpmScript(scriptName, useSharedTerminal) {
  const terminal = getTerminal(scriptName, useSharedTerminal);
  terminal.sendText(`npm run ${scriptName}`);
  terminal.show();
}

/**
 * Generate the webview HTML content
 * @param {Object} scripts
 * @param {vscode.Webview} webview
 * @returns {string} HTML content
 */
function getWebviewContent(scripts, webview) {
  const scriptEntries = Object.entries(scripts);

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NPM Scripts Runner</title>
    <style>
      body {
        font-family: var(--vscode-font-family);
        padding: 20px;
        color: var(--vscode-foreground);
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }
      .title {
        font-size: 1.5em;
        font-weight: bold;
      }
      .controls {
        display: flex;
        align-items: center;
        gap: 15px;
      }
      .toggle-container {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .toggle {
        position: relative;
        display: inline-block;
        width: 40px;
        height: 20px;
      }
      .toggle input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--vscode-input-background);
        transition: .4s;
        border-radius: 10px;
      }
      .slider:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 3px;
        bottom: 3px;
        background-color: var(--vscode-button-background);
        transition: .4s;
        border-radius: 50%;
      }
      input:checked + .slider {
        background-color: var(--vscode-inputOption-activeBackground);
      }
      input:checked + .slider:before {
        transform: translateX(20px);
      }
      .toggle-label {
        font-size: 0.9em;
      }
      .script-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .script-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
      }
      .script-name {
        font-weight: bold;
      }
      .script-command {
        color: var(--vscode-textPreformat-foreground);
        font-family: var(--vscode-editor-font-family);
        font-size: 0.9em;
        margin-left: 10px;
      }
      .run-button {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 6px 12px;
        border-radius: 2px;
        cursor: pointer;
      }
      .run-button:hover {
        background-color: var(--vscode-button-hoverBackground);
      }
      .refresh-button {
        background-color: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        padding: 6px 12px;
        border-radius: 2px;
        cursor: pointer;
      }
      .refresh-button:hover {
        background-color: var(--vscode-button-secondaryHoverBackground);
      }
      .empty-state {
        text-align: center;
        padding: 40px;
        color: var(--vscode-disabledForeground);
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="title">NPM Scripts Runner</div>
      <div class="controls">
        <div class="toggle-container">
          <label class="toggle">
            <input type="checkbox" id="terminalToggle">
            <span class="slider"></span>
          </label>
          <span class="toggle-label">Shared Terminal</span>
        </div>
        <button class="refresh-button" id="refreshButton">Refresh</button>
      </div>
    </div>

    ${
      scriptEntries.length > 0
        ? `
      <div class="script-list">
        ${scriptEntries
          .map(
            ([name, command]) => `
          <div class="script-item">
            <div>
              <span class="script-name">${name}</span>
              <span class="script-command">${command}</span>
            </div>
            <button class="run-button" data-script="${name}">Run</button>
          </div>
        `
          )
          .join("")}
      </div>
    `
        : `
      <div class="empty-state">
        <p>No scripts found in package.json</p>
      </div>
    `
    }

    <script>
      (function() {
        const vscode = acquireVsCodeApi();

        // Initialize toggle state (could be loaded from saved state)
        const terminalToggle = document.getElementById('terminalToggle');

        // Add event listeners to run buttons
        document.querySelectorAll('.run-button').forEach(button => {
          button.addEventListener('click', () => {
            const script = button.getAttribute('data-script');
            vscode.postMessage({
              command: 'runScript',
              script: script,
              useSharedTerminal: terminalToggle.checked
            });
          });
        });

        // Add event listener to refresh button
        document.getElementById('refreshButton').addEventListener('click', () => {
          vscode.postMessage({
            command: 'refresh'
          });
        });

        // Add event listener to terminal toggle
        terminalToggle.addEventListener('change', () => {
          vscode.postMessage({
            command: 'saveSettings',
            useSharedTerminal: terminalToggle.checked
          });
        });
      })();
    </script>
  </body>
  </html>`;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
