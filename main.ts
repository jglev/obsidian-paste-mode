import {
  App, MarkdownView, Notice, Plugin, PluginSettingTab, Setting 
} from 'obsidian';

interface PastetoIndentationPluginSettings {
  blockquotePrefix: string;
}

const DEFAULT_SETTINGS: PastetoIndentationPluginSettings = {
  blockquotePrefix: '> '
}

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping,
// which, as a code snippet, is in the public domain, per 
// https://developer.mozilla.org/en-US/docs/MDN/About#copyrights_and_licenses
// (as of 2021-07-15):
function escapeRegExp(string: string) {
  // $& means the whole matched string:
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default class PastetoIndentationPlugin extends Plugin {
  settings: PastetoIndentationPluginSettings;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new SettingTab(this.app, this));

    this.addCommand({
      id: 'paste-text-to-current-indentation',
      name: 'Paste text to current indentation',
      checkCallback: (checking: boolean) => {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking) {
            this.pasteText(view);
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: 'paste-blockquote-to-current-indentation',
      name: 'Paste blockquote to current indentation',
      checkCallback: (checking: boolean) => {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking && view instanceof MarkdownView) {
            this.pasteText(view, this.settings.blockquotePrefix);
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: 'toggle-blockquote-at-current-indentation',
      name: 'Toggle blockquote at current indentation',
      checkCallback: (checking: boolean) => {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking && view instanceof MarkdownView) {
            this.toggleQuote(view, this.settings.blockquotePrefix);
          }
          return true;
        }
        return false;
      }
    });
  }

  async pasteText(view: MarkdownView, prefix: string = '') {
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

  async toggleQuote(
    view: MarkdownView,
    prefix: string = this.settings.blockquotePrefix
  ) {
    const editor = view.editor;
    const escapedPrefix = escapeRegExp(prefix);
    const currentSelectionStart = editor.getCursor('from');
    const currentSelectionEnd = editor.getCursor('to');
    
    const replacementRange = [
      {line: currentSelectionStart.line, ch: 0},
      {
        line: currentSelectionEnd.line,
        ch: editor.getLine(currentSelectionEnd.line).length
      }
    ]

    const fullSelectedLines = editor.getRange(
      replacementRange[0],
      replacementRange[1]
    ).split('\n');

    const leadingWhitespaces = fullSelectedLines.map(
      (e: string) => {
        const whitespaceMatch = e.match(new RegExp(`^(\\s*)`));
        return whitespaceMatch !== null ? whitespaceMatch[1] : '';
      }
    );
    // This is in its own variable to aid in debugging:
    const filteredLeadingWhitespaces = (leadingWhitespaces
        .filter((e: string) => {
          // Get rid of blank lines, which might be part of multi-line
          // passages:
          return e !== ''
        }) ||
          // Account for if all lines actually *are* unindented, and we thus
          // filtered all lines out immediately above:
          ['']
        )
        .map((e: string) => e.length)
    const minLeadingWhitespaceLength = Math.min(...filteredLeadingWhitespaces);
    
    // Determine whether *every* line is Prefixed or not. If not, we will
    // add the prefix to every line; if so, we will remove it from every line.
    const isEveryLinePrefixed = fullSelectedLines.every(
      (e: string) => {
        const prefixMatch = e.match(
          new RegExp(`^\\s{${minLeadingWhitespaceLength}}${escapedPrefix}`)
        );
        if (prefixMatch !== null) {
          return true;
        }
        return false;
      }
    );

    // Make an educated guess about using tabs vs spaces (lacking access to the
    // "Use Tabs" setting value in Obsidian for now) by just repurposing the
    // first actual instance of leading whitespace:
    const exampleLeadingWhitespace = leadingWhitespaces
    .filter(e => e.length === minLeadingWhitespaceLength);
    // Update the text in-place:
    for (const [i, text] of fullSelectedLines.entries()) {
      if (isEveryLinePrefixed === true) {
        if (text === '') {
          fullSelectedLines[i] = exampleLeadingWhitespace.length > 0 ? 
            exampleLeadingWhitespace[0] : 
            ' '.repeat(minLeadingWhitespaceLength);
          continue
        }
        fullSelectedLines[i] = text.replace(
          new RegExp(`^(\\s{${minLeadingWhitespaceLength}})${escapedPrefix}`),
          '$1'
          )
          continue
      }

      if (text === '') {
        fullSelectedLines[i] = (exampleLeadingWhitespace.length > 0 ? 
          exampleLeadingWhitespace[0] : 
          ' '.repeat(minLeadingWhitespaceLength)) + prefix;
        continue
      }

      // If the prefix is already in the correct place, do not add to it:
      if (!text.match(
        new RegExp(`^\\s{${minLeadingWhitespaceLength}}${escapedPrefix}`)
      )) {
        fullSelectedLines[i] = text.replace(
          new RegExp(`^(\\s{${minLeadingWhitespaceLength}})`),
          `$1${prefix}`
        )
      }
    }

    editor.replaceRange(
      fullSelectedLines.join('\n'),
      replacementRange[0],
      replacementRange[1]
    );

    editor.setSelection(
      {
        line: currentSelectionStart.line,
        ch: isEveryLinePrefixed ? 
          currentSelectionStart.ch - prefix.length: 
          currentSelectionStart.ch + prefix.length
      },
      {
        line: currentSelectionEnd.line,
        ch: isEveryLinePrefixed ? 
          currentSelectionEnd.ch - prefix.length: 
          currentSelectionEnd.ch + prefix.length
      }
    );

    return
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SettingTab extends PluginSettingTab {
  plugin: PastetoIndentationPlugin;

  constructor(app: App, plugin: PastetoIndentationPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let {containerEl} = this;

    containerEl.empty();

    containerEl.createEl('h2', {text: 'Paste to Current Indentation'});

    new Setting(containerEl)
      .setName('Blockquote Prefix')
      .setDesc(
        'Markdown syntax to signify that a line is part of a blockquote.'
      )
      .addText(text => text
        .setPlaceholder('>•')
        .setValue(
          this.plugin.settings.blockquotePrefix === DEFAULT_SETTINGS.blockquotePrefix ?
            '' :
            this.plugin.settings.blockquotePrefix
        )
        .onChange(async (value) => {
          this.plugin.settings.blockquotePrefix = value !== '' 
            ? value :
            DEFAULT_SETTINGS.blockquotePrefix;
          await this.plugin.saveSettings();
        }));
  }
}
