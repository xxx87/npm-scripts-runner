import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Finds all package.json files in the workspace using VS Code API
 * @returns Array of absolute paths to package.json files
 */
export async function findAllPackageJsonFiles(): Promise<string[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return [];
  }

  const packageFiles: string[] = [];

  try {
    // Use VS Code's built-in file search API instead of glob
    const fileUris = await vscode.workspace.findFiles(
      '**/package.json',
      '**/node_modules/**'
    );

    // Convert URIs to file paths
    packageFiles.push(...fileUris.map(uri => uri.fsPath));
  } catch (error) {
    console.error(`Error finding package.json files: ${error instanceof Error ? error.message : String(error)}`);
  }

  return packageFiles;
}

/**
 * Gets npm scripts from all package.json files
 * @param packageFiles Array of paths to package.json files
 * @returns Object with package paths as keys and scripts as values
 */
export function getAllNpmScripts(packageFiles: string[]): Record<string, PackageInfo> {
  const allScripts: Record<string, PackageInfo> = {};

  for (const packageFile of packageFiles) {
    try {
      if (fs.existsSync(packageFile)) {
        const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
        const scripts = packageJson.scripts || {};

        // Get relative path from workspace root
        const workspaceFolder = vscode.workspace.workspaceFolders![0].uri.fsPath;
        let relativePath = path.relative(workspaceFolder, path.dirname(packageFile));

        // Use '/' for root package.json
        if (!relativePath) {
          relativePath = '/';
        }

        // Store scripts with their package path
        allScripts[relativePath] = {
          scripts,
          packageName: packageJson.name || path.basename(path.dirname(packageFile)),
          absolutePath: packageFile
        };
      }
    } catch (error) {
      console.error(`Error reading ${packageFile}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return allScripts;
}

export interface PackageInfo {
  scripts: Record<string, string>;
  packageName: string;
  absolutePath: string;
}