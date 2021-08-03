// Mock several classes from Obsidian, following
// https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts:

class Notice {
  msg: string

  constructor(
    msg: string
  ) {
    this.msg = msg;
  }
}

class Editor {
  content: string[]
  selectionStart: {line: number, ch: number}
  selectionEnd: {line: number, ch: number}
  selection: {line: number, ch: number}[]

  constructor(
    content: string[],
    selectionStart: {line: number, ch: number},
    selectionEnd: {line: number, ch: number},
  ) {
    this.content = content;
    this.selection = [selectionStart, selectionEnd];
  }

  getCursor() {
    return this.selection[0];
  }

  getLine(line: number) {
    return this.content[line];
  }

  getRange(
    start: {line: number, ch: number},
    end: {line: number, ch: number}
  ) {
    const contentInRange = this.content.slice(start.line, end.line + 1);
    contentInRange[0] = contentInRange[0].slice(start.ch);
    contentInRange[contentInRange.length - 1] = contentInRange[contentInRange.length - 1].slice(0, end.ch);

    return contentInRange.join('\n');
  }
  
  setSelection(
    start: {line: number, ch: number},
    end: {line: number, ch: number}
  ) {
    this.selection = [start, end]
  }

  replaceSelection(text: string) {
    this.content.splice(
      this.selection[0].line,
      this.selection[1].line - this.selection[0].line,
      ...(
        this.content[this.selection[0].line].slice(0, this.selection[0].ch) + 
        text +
        this.content[this.selection[1].line].slice(this.selection[1].ch)
      ).split('\n')
    )
  }

  replaceRange(
    text: string,
    start: {line: number, ch: number},
    end: {line: number, ch: number}
  ) {
    this.content.splice(
      start.line,
      end.line - start.line + 1,
      ...(
        this.content[start.line].slice(0, start.ch) + 
        text +
        this.content[end.line].slice(end.ch)
      ).split('\n')
    )
  }
}

export class MarkdownView {
  content: string[]
  selectionStart: {line: number, ch: number}
  selectionEnd: {line: number, ch: number}
  editor: Editor

  constructor(
    content: string[],
    selectionStart: {line: number, ch: number},
    selectionEnd: {line: number, ch: number},
  ) {
    this.editor = new Editor(
      content,
      selectionStart,
      selectionEnd
    );
  }
}

export {};

