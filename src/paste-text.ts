import { MarkdownView, Notice } from 'obsidian';

export const pasteText = async (
  view: MarkdownView,
  prefix: string = ''
) => {
  const editor = view.editor;
  const clipboardText = await navigator.clipboard.readText();
  if (clipboardText !== '') {
    const currentCursor = editor.getCursor();
    const currentLineText = editor.getLine(
      currentCursor.line
    );
    const leadingWhitespace = currentLineText.match(/^(\s*).*/)[1];
    const clipboardTextIndented = clipboardText.replaceAll(
      /\n/g, '\n' + leadingWhitespace + prefix);
    const replacementText = prefix + 
        clipboardTextIndented;
    editor.replaceSelection(replacementText);

    return;
  }

  new Notice('The clipboard is currently empty.');
}
