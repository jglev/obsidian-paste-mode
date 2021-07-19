// Mock several classes from Obsidian, following
// https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts:

export class Editor {
  content: string[]
  selectionStart: {line: number, ch: number}
  selectionEnd: {line: number, ch: number}
  selection: {line: number, ch: number}[]
  cursor: {line: number, ch: number}

  constructor(
    content: string[],
    selectionStart: {line: number, ch: number},
    selectionEnd: {line: number, ch: number},
    cursor: {line: number, ch: number}
  ) {
    this.content = content;
    this.selectionStart = selectionStart;
    this.selectionEnd = selectionEnd;

    this.selection = [selectionStart, selectionEnd];
    this.cursor = cursor;
  }

  getCursor() {
    return this.cursor;
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

    return contentInRange;
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
      end.line - start.line,
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
  cursor: {line: number, ch: number}

  constructor(
    content: string[],
    selectionStart: {line: number, ch: number},
    selectionEnd: {line: number, ch: number},
    cursor: {line: number, ch: number}
  ) {
    this.content = content;
    this.selectionStart = selectionStart;
    this.selectionEnd = selectionEnd;

    this.editor = new Editor(
      this.content,
      this.selectionStart,
      this.selectionEnd,
      this.cursor
    );
  }
}

const view = new MarkdownView(
  [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Sed venenatis lectus et leo viverra, ac viverra purus rutrum.',
    '',
    'Etiam semper massa ut est faucibus, eu luctus arcu porttitor.'
  ],
  {line: 0, ch: 0},
  {line: 0, ch: 0},
  {line: 0, ch: 0}
)

// test('adds 1 + 2 to equal 3', () => {
//   expect(sum(1, 2)).toBe(3);
// });

console.log(view);
