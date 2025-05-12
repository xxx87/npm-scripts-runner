import * as vscode from 'vscode';
import { PackageInfo } from '../utils/packageJsonFinder';

/**
 * Generates the HTML content for the error webview
 * @param errorMessage Error message to display
 * @returns HTML content as string
 */
export function getErrorWebviewContent(errorMessage: string): string {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NPM Scripts Runner - Error</title>
    <style>
      body {
        font-family: var(--vscode-font-family);
        padding: 20px;
        color: var(--vscode-foreground);
      }
      .error {
        color: var(--vscode-errorForeground);
        padding: 20px;
        border: 1px solid var(--vscode-errorForeground);
        border-radius: 4px;
      }
    </style>
  </head>
  <body>
    <h1>Error</h1>
    <div class="error">
      <p>${errorMessage}</p>
      <p>Please try refreshing or restarting VS Code.</p>
    </div>
    <button id="refreshButton">Refresh</button>
    <script>
      (function() {
        const vscode = acquireVsCodeApi();
        document.getElementById('refreshButton').addEventListener('click', () => {
          vscode.postMessage({ command: 'refresh' });
        });
      })();
    </script>
  </body>
  </html>`;
}

/**
 * Generates the HTML content for the webview
 * @param packageScripts Object containing all scripts from package.json files
 * @param webview Webview instance
 * @returns HTML content as string
 */
export function getWebviewContent(
  packageScripts: Record<string, PackageInfo>,
  webview: vscode.Webview
): string {
  const packagePaths = Object.keys(packageScripts).sort((a, b) => {
    // Sort root package first, then alphabetically
    if (a === '/') return -1;
    if (b === '/') return 1;
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

              if (scriptEntries.length === 0) return '';

              return `
              <div class="package-group" data-path="${packageData.absolutePath}">
                <div class="package-header">
                  <div>
                    <span class="package-name">${packageData.packageName}</span>
                    <span class="package-path">${packagePath === '/' ? '(root)' : packagePath}</span>
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
                      .join('')}
                  </div>
                </div>
              </div>
            `;
            })
            .join('')
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