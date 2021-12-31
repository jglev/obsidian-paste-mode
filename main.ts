import {
  App,
  Editor,
  htmlToMarkdown,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  Workspace,
} from "obsidian";

import { toggleQuote } from "./src/toggle-quote";
import { pasteText } from "./src/paste-text";
import { pasteHTMLBlockquoteText } from "./src/paste-html-blockquote-text";

interface PastetoIndentationPluginSettings {
  blockquotePrefix: string;
}

const DEFAULT_SETTINGS: PastetoIndentationPluginSettings = {
  blockquotePrefix: "> ",
};

export default class PastetoIndentationPlugin extends Plugin {
  settings: PastetoIndentationPluginSettings;

  async onload() {
    await this.loadSettings();

    console.log(30);

    this.addSettingTab(new SettingTab(this.app, this));

    this.app.workspace.on(
      "editor-paste",
      (evt: ClipboardEvent, editor: Editor, markdownView: MarkdownView) => {
        // Per https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L3690,
        // "Check for `evt.defaultPrevented` before attempting to handle this
        // event, and return if it has been already handled."
        if (evt.defaultPrevented) {
          return;
        }
        // console.log(43);
        evt.preventDefault();

        const currentLine = editor.getCursor().line;

        // editor.setLine(currentLine, `TESTER${editor.getLine(currentLine)}`);

        console.log(35, evt, editor, markdownView);
        console.log(52, evt.clipboardData.getData("text"));
        console.log(53, evt.clipboardData.getData("text/html"));

        const items = evt.clipboardData.items;

        for (var i = 0; i < items.length; i++) {
          // Skip content if not image
          if (items[i].type.indexOf("image") == -1) continue;
          // Retrieve image on clipboard as blob
          var blob = items[i].getAsFile();
        }

        this.app.workspace.trigger("paste");

        console.log(57, htmlToMarkdown(evt.clipboardData.getData("text/html")));

        return "TEST1";
      }
    );

    this.addCommand({
      id: "paste-text-to-current-indentation",
      name: "Paste text to current indentation",
      checkCallback: (checking: boolean) => {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking) {
            pasteText(view);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "paste-blockquote-to-current-indentation",
      name: "Paste blockquote to current indentation",
      checkCallback: (checking: boolean) => {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking && view instanceof MarkdownView) {
            pasteText(view, this.settings.blockquotePrefix);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "paste-html-wrapped-blockquote",
      name: "Paste HTML-wrapped blockquote to current indentation",
      checkCallback: (checking: boolean) => {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking && view instanceof MarkdownView) {
            pasteHTMLBlockquoteText(view);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "toggle-blockquote-at-current-indentation",
      name: "Toggle blockquote at current indentation",
      checkCallback: (checking: boolean) => {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking && view instanceof MarkdownView) {
            toggleQuote(view, this.settings.blockquotePrefix);
          }
          return true;
        }
        return false;
      },
    });
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
