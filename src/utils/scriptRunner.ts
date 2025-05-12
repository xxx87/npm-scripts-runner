import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Gets or creates a terminal based on settings
 * @param scriptName Name of the script to run
 * @param packagePath Path to package.json
 * @param useSharedTerminal Whether to use a shared terminal for all scripts
 * @returns VS Code terminal instance
 */
export function getTerminal(
  scriptName: string,
  packagePath: string,
  useSharedTerminal: boolean
): vscode.Terminal {
  if (useSharedTerminal) {
    // Use a shared terminal or create one if it doesn't exist
    const terminalName = 'NPM Scripts Runner';
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
 * Runs an npm script
 * @param scriptName Name of the script to run
 * @param packagePath Path to package.json
 * @param useSharedTerminal Whether to use a shared terminal for all scripts
 */
export function runNpmScript(
  scriptName: string,
  packagePath: string,
  useSharedTerminal: boolean
): void {
  const terminal = getTerminal(scriptName, packagePath, useSharedTerminal);

  // Change to the directory containing package.json
  const packageDir = path.dirname(packagePath);

  // Use different commands for Windows vs Unix-like systems
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    terminal.sendText(`cd "${packageDir}"`);
  } else {
    terminal.sendText(`cd "${packageDir.replace(/"/g, '\\"')}"`);
  }

  terminal.sendText(`npm run ${scriptName}`);
  terminal.show();
}