import { MarkdownView, Notice } from "obsidian";

export const pasteHTMLBlockquoteText = async (view: MarkdownView) => {
  const editor = view.editor;
  const clipboardText = await navigator.clipboard.readText();
  if (clipboardText !== "") {
    const currentCursor = editor.getCursor();
    const currentLineText = editor.getLine(currentCursor.line);
    const leadingWhitespace = currentLineText.match(/^(\s*).*/)[1];
    const padding = '  ';
    const clipboardTextIndented = clipboardText.replaceAll(
      /\n/g,
      `\n${leadingWhitespace}${padding}`
    ).replace(
      /(\n\s*)*$/,
      ''
    );
    console.log(18, clipboardTextIndented);
    const replacementText =
      `<blockquote>\n${leadingWhitespace}${padding}` +
      clipboardTextIndented +
      `\n${leadingWhitespace}<blockquote>`;
    editor.replaceSelection(replacementText);

    return;
  }

  new Notice("The clipboard is currently empty.");
};
