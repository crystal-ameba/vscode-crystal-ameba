# Ameba for Visual Studio Code

This extension provides interface to [Ameba](https://github.com/crystal-ameba/ameba) for VSCode.

![](https://github.com/crystal-ameba/vscode-crystal-ameba/blob/master/assets/demo.png?raw=true)

## Installation

* Install [Ameba](https://github.com/crystal-ameba/ameba#installation)
* Type F1 (or Command + Shift + P)
* execute "Extensions: install extension"
* type `crystal-ameba` and install

## Releasing a new version

1. Update CHANGELOG.md
2. Bump a new version
3. Build an extension `vsce package`
4. Publish to the [marketplace](https://marketplace.visualstudio.com/manage/publishers/veelenga)
