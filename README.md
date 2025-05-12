# NPM Scripts Runner

A VS Code extension that makes it easy to run npm scripts from your package.json file with a simple click of a button.

## Features

- Displays all npm scripts from your package.json file as clickable buttons
- Shows the actual command that will be executed
- Automatically refreshes when package.json changes
- Runs scripts in a dedicated terminal
- Accessible from the status bar
- Option to run scripts in a shared terminal or in separate terminals for each script

## Usage

1. Click on the "NPM Scripts" button in the status bar or run the "Show NPM Scripts Runner" command from the command palette
2. A panel will open showing all available npm scripts
3. Click the "Run" button next to any script to execute it
4. The script will run in a dedicated terminal

## Requirements

- VS Code 1.60.0 or higher
- A project with a package.json file containing scripts

## Extension Settings

This extension does not contribute any settings yet.

## Terminal Options

The extension provides two modes for running scripts:

- **Separate Terminals**: Each script runs in its own dedicated terminal (default)
- **Shared Terminal**: All scripts run in a single shared terminal

You can toggle between these modes using the "Shared Terminal" switch in the NPM Scripts Runner panel.

## Known Issues

None at the moment.

## Release Notes

### 0.1.0

Initial release of NPM Scripts Runner
