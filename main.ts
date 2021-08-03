import {
  App, MarkdownView, Notice, Plugin, PluginSettingTab, Setting 
} from 'obsidian';

import { toggleQuote } from './src/toggle-quote';
import { pasteText } from './src/paste-text';
import { pasteHTMLBlockquoteText } from "./src/paste-html-blockquote-text";

interface PastetoIndentationPluginSettings {
  blockquotePrefix: string;
}

const DEFAULT_SETTINGS: PastetoIndentationPluginSettings = {
  blockquotePrefix: '> '
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
            pasteText(view);
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
            pasteText(view, this.settings.blockquotePrefix);
          }
          return true;
        }
        return false;
      }
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
      id: 'toggle-blockquote-at-current-indentation',
      name: 'Toggle blockquote at current indentation',
      checkCallback: (checking: boolean) => {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking && view instanceof MarkdownView) {
            toggleQuote(view, this.settings.blockquotePrefix);
          }
          return true;
        }
        return false;
      }
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
