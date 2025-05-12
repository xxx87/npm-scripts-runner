const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { glob } = require("glob");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log("NPM Scripts Runner is now active!");

  // Create status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = "$(play) NPM Scripts";
  statusBarItem.command = "npm-scripts-runner.showScripts";
  statusBarItem.tooltip = "Show NPM Scripts Runner";

  // Check if package.json exists and show the button
  updateStatusBarVisibility(statusBarItem);

  // Update visibility when files change
  const watcher = vscode.workspace.createFileSystemWatcher("**/package.json");
  watcher.onDidCreate(() => updateStatusBarVisibility(statusBarItem));
  watcher.onDidDelete(() => updateStatusBarVisibility(statusBarItem));

  // Update visibility when workspace folders change
  vscode.workspace.onDidChangeWorkspaceFolders(() => updateStatusBarVisibility(statusBarItem));

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
            runNpmScript(message.script, message.packagePath, message.useSharedTerminal);
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
    const scriptWatcher = vscode.workspace.createFileSystemWatcher("**/package.json");
    scriptWatcher.onDidChange(() => updateWebview(panel));
    scriptWatcher.onDidCreate(() => updateWebview(panel));
    scriptWatcher.onDidDelete(() => updateWebview(panel));

    context.subscriptions.push(scriptWatcher);
  });

  context.subscriptions.push(statusBarItem, watcher, disposable);
}

/**
 * Update status bar visibility based on whether package.json exists
 * @param {vscode.StatusBarItem} statusBarItem
 */
function updateStatusBarVisibility(statusBarItem) {
  findAllPackageJsonFiles().then((packageFiles) => {
    if (packageFiles.length > 0) {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  });
}

/**
 * Update the webview content
 * @param {vscode.WebviewPanel} panel
 */
function updateWebview(panel) {
  findAllPackageJsonFiles().then((packageFiles) => {
    const packageScripts = getAllNpmScripts(packageFiles);
    panel.webview.html = getWebviewContent(packageScripts, panel.webview);
  });
}

/**
 * Find all package.json files in the workspace
 * @returns {Promise<string[]>} Array of absolute paths to package.json files
 */
async function findAllPackageJsonFiles() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return [];
  }

  const packageFiles = [];

  for (const folder of workspaceFolders) {
    const rootPath = folder.uri.fsPath;

    // Use glob to find all package.json files, excluding node_modules
    const pattern = path.join(rootPath, "**/package.json");
    const ignore = path.join(rootPath, "**/node_modules/**");

    try {
      const files = await glob(pattern, { ignore });
      packageFiles.push(...files);
    } catch (error) {
      console.error(`Error finding package.json files: ${error.message}`);
    }
  }

  return packageFiles;
}

/**
 * Get npm scripts from all package.json files
 * @param {string[]} packageFiles Array of paths to package.json files
 * @returns {Object} Object with package paths as keys and scripts as values
 */
function getAllNpmScripts(packageFiles) {
  const allScripts = {};

  for (const packageFile of packageFiles) {
    try {
      if (fs.existsSync(packageFile)) {
        const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
        const scripts = packageJson.scripts || {};

        // Get relative path from workspace root
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        let relativePath = path.relative(workspaceFolder, path.dirname(packageFile));

        // Use '/' for root package.json
        if (!relativePath) {
          relativePath = "/";
        }

        // Store scripts with their package path
        allScripts[relativePath] = {
          scripts,
          packageName: packageJson.name || path.basename(path.dirname(packageFile)),
          absolutePath: packageFile
        };
      }
    } catch (error) {
      console.error(`Error reading ${packageFile}: ${error.message}`);
    }
  }

  return allScripts;
}

/**
 * Get or create terminal based on settings
 * @param {string} scriptName
 * @param {string} packagePath
 * @param {boolean} useSharedTerminal
 * @returns {vscode.Terminal}
 */
function getTerminal(scriptName, packagePath, useSharedTerminal) {
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
    const packageName = path.basename(path.dirname(packagePath));
    return vscode.window.createTerminal(`npm: ${packageName} - ${scriptName}`);
  }
}

/**
 * Run an npm script
 * @param {string} scriptName
 * @param {string} packagePath
 * @param {boolean} useSharedTerminal
 */
function runNpmScript(scriptName, packagePath, useSharedTerminal) {
  const terminal = getTerminal(scriptName, packagePath, useSharedTerminal);

  // Change to the directory containing package.json
  const packageDir = path.dirname(packagePath);

  // Use different commands for Windows vs Unix-like systems
  const isWindows = process.platform === "win32";

  if (isWindows) {
    terminal.sendText(`cd "${packageDir}"`);
  } else {
    terminal.sendText(`cd "${packageDir.replace(/"/g, '\\"')}"`);
  }

  terminal.sendText(`npm run ${scriptName}`);
  terminal.show();
}

/**
 * Generate the webview HTML content
 * @param {Object} packageScripts
 * @param {vscode.Webview} webview
 * @returns {string} HTML content
 */
function getWebviewContent(packageScripts, webview) {
  const packagePaths = Object.keys(packageScripts).sort((a, b) => {
    // Sort root package first, then alphabetically
    if (a === "/") return -1;
    if (b === "/") return 1;
    return a.localeCompare(b);
  });

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
      .package-group {
        margin-bottom: 30px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        overflow: hidden;
      }
      .package-header {
        background-color: var(--vscode-sideBar-background);
        padding: 10px 15px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
      }
      .package-name {
        font-size: 1.1em;
      }
      .package-path {
        font-size: 0.9em;
        opacity: 0.8;
        margin-left: 10px;
      }
      .script-list {
        display: flex;
        flex-direction: column;
      }
      .script-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        border-top: 1px solid var(--vscode-panel-border);
      }
      .script-item:hover {
        background-color: var(--vscode-list-hoverBackground);
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
      .collapse-icon {
        transition: transform 0.3s;
      }
      .collapsed .collapse-icon {
        transform: rotate(-90deg);
      }
      .package-content {
        max-height: 1000px;
        transition: max-height 0.3s ease-in-out;
        overflow: hidden;
      }
      .collapsed .package-content {
        max-height: 0;
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
      packagePaths.length > 0
        ? packagePaths
            .map((packagePath) => {
              const packageData = packageScripts[packagePath];
              const scriptEntries = Object.entries(packageData.scripts);

              if (scriptEntries.length === 0) return "";

              return `
              <div class="package-group" data-path="${packageData.absolutePath}">
                <div class="package-header">
                  <div>
                    <span class="package-name">${packageData.packageName}</span>
                    <span class="package-path">${packagePath === "/" ? "(root)" : packagePath}</span>
                  </div>
                  <span class="collapse-icon">▼</span>
                </div>
                <div class="package-content">
                  <div class="script-list">
                    ${scriptEntries
                      .map(
                        ([name, command]) => `
                      <div class="script-item">
                        <div>
                          <span class="script-name">${name}</span>
                          <span class="script-command">${command}</span>
                        </div>
                        <button class="run-button" data-script="${name}" data-package="${packageData.absolutePath}">Run</button>
                      </div>
                    `
                      )
                      .join("")}
                  </div>
                </div>
              </div>
            `;
            })
            .join("")
        : `
          <div class="empty-state">
            <p>No scripts found in any package.json files</p>
          </div>
        `
    }

    <script>
      (function() {
        const vscode = acquireVsCodeApi();

        // Initialize toggle state
        const terminalToggle = document.getElementById('terminalToggle');

        // Add event listeners to run buttons
        document.querySelectorAll('.run-button').forEach(button => {
          button.addEventListener('click', () => {
            const script = button.getAttribute('data-script');
            const packagePath = button.getAttribute('data-package');
            vscode.postMessage({
              command: 'runScript',
              script: script,
              packagePath: packagePath,
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

        // Add event listeners to package headers for collapsing
        document.querySelectorAll('.package-header').forEach(header => {
          header.addEventListener('click', () => {
            const packageGroup = header.parentElement;
            packageGroup.classList.toggle('collapsed');
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
