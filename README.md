# VSCode Latex Preview Extension

## Features

* Inline preview of LaTeX documents, automatically updated on save.
* Generate VSCode build tasks for LaTeX documents.
* Click on a document position to go to the relevant source code.
* Use a context menu item to go from source code to a preview document position.

## Commands

| Title | Description |
| --- | --- |
| LaTeX: Create Build Command | Prompts to select a `.tex` file and creates a task in `tasks.json` to build it using `pdflatex`. |
| LaTeX: Show Preview | Opens a preview of the current document in a new tab. The preview updates when the document is saved. |
| LaTeX: Show Preview to Side | Opens a preview in a column alongside the current document. |
| LaTeX: Show in Preview | Jumps to the current cursor position in the preview document. |
| LaTeX: Show Source | Shows the source document for the current preview. |
