import {
  App,
  Editor,
  FuzzySuggestModal,
  htmlToMarkdown,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  Workspace,
} from "obsidian";

import { toggleQuote } from "./src/toggle-quote";
import { pasteText } from "./src/paste-text";
import { pasteHTMLBlockquoteText } from "./src/paste-html-blockquote-text";

enum Mode {
  Text = "text",
  TextBlockquote = "text-blockquote",
  Markdown = "markdown",
  MarkdownBlockquote = "markdown-blockquote",
  Passthrough = "passthrough",
}

class PasteModeModal extends FuzzySuggestModal<number> {
  public readonly onChooseItem: (item: number) => void;

  constructor({
    app,
    onChooseItem,
  }: {
    app: App;
    onChooseItem: (patternIndex: number) => void;
  }) {
    super(app);

    this.onChooseItem = (patternIndex: number) => {
      onChooseItem(patternIndex);
      // Note: Using this.close() here was causing a bug whereby new
      // text was unable to be typed until the user had opened another
      // modal or switched away from the window. @lishid noted at
      // https://github.com/obsidianmd/obsidian-releases/pull/396#issuecomment-894017526
      // that the modal is automatically closed at the conclusion of
      // onChooseItem.
    };
  }

  getItems(): number[] {
    return Object.keys(Mode).map((key, index) => index);
  }

  getItemText(index: number): string {
    return Object.values(Mode)[index];
  }
}

interface PastetoIndentationPluginSettings {
  blockquotePrefix: string;
  mode: Mode;
}

const DEFAULT_SETTINGS: PastetoIndentationPluginSettings = {
  blockquotePrefix: "> ",
  mode: Mode.Markdown,
};

export default class PastetoIndentationPlugin extends Plugin {
  settings: PastetoIndentationPluginSettings;
  statusBar: HTMLElement;

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
        console.log(46, evt.clipboardData.types);
        if (evt.defaultPrevented) {
          return;
        }
        if (evt.clipboardData.types.every((type) => type === "files")) {
          return;
        }

        evt.preventDefault();

        const currentLine = editor.getCursor().line;

        editor.setLine(currentLine, `TESTER${editor.getLine(currentLine)}`);

        console.log(35, evt, editor, markdownView);
        console.log(52, evt.clipboardData.getData("text"));
        console.log(53, evt.clipboardData.getData("text/html"));

        const items = evt.clipboardData.items;

        let output: string[] = [];

        for (var i = 0; i < items.length; i++) {
          if (items[i] === undefined) {
            continue;
          }

          console.log(59, items[i].kind, items[i]);
          const item = items[i];
          if (item.kind == "string") {
            item.getAsString((data) => {
              if (item.type === "text/html") {
                output.push(htmlToMarkdown(data));
                return;
              }
              // item.type is "text"
              output.push(data);
            });
          }
          if (item.kind == "file") {
            const blob = item.getAsFile();
            console.log(71, blob);
            // output.push(blob.name);
            const currentDateTime = new Date()
              .toISOString()
              .replaceAll(/[:-]/g, "")
              .slice(0, 15);
            const blobFileName = `${currentDateTime}${
              blob.name != undefined && blob.name !== "" ? "-" : ""
            }${blob.name}`;
            const file = new File([blob], blob.name, {
              type: blob.type,
              lastModified: blob.lastModified,
            });
            console.log(99, file);
            // const blobLink = this.app.fileManager.generateMarkdownLink(
            //   new TFile(),
            //   blobFileName
            // );
            // output.push(blobLink);
          }
        }

        console.log(83, output);
        this.app.workspace.trigger("paste");

        console.log(57, htmlToMarkdown(evt.clipboardData.getData("text/html")));
      }
    );

    Object.values(Mode).forEach((value) => {
      this.addCommand({
        id: `past-mode-${value}`,
        name: `Set Paste Mode to ${value}`,
        callback: async () => {
          this.settings.mode = value;
          await this.saveSettings();
          this.statusBar.setText(`Paste Mode: ${value}`);
        },
      });
    });

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

    this.statusBar = this.addStatusBarItem();
    this.statusBar.setText(`Paste Mode: ${this.settings.mode}`);
    const onChooseItem = async (item: number): Promise<void> => {
      const selection = Object.values(Mode)[item];
      this.settings.mode = selection;
      await this.saveSettings();
      this.statusBar.setText(`Paste Mode: ${selection}`);
    };
    const app = this.app;
    this.statusBar.onClickEvent(() => {
      const newMode = new PasteModeModal({ app, onChooseItem });
      newMode.open();
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
    let { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Paste to Current Indentation" });

    new Setting(containerEl)
      .setName("Paste Mode")
      .setDesc("Mode that the paste command will invoke.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption(Mode.Text, "Plain Text")
          .addOption(Mode.TextBlockquote, "Plain Text (Blockquote)")
          .addOption(Mode.Markdown, "Markdown")
          .addOption(Mode.MarkdownBlockquote, "Markdown (Blockquote)")
          .addOption(Mode.Passthrough, "Passthrough")
          .setValue(this.plugin.settings.mode || DEFAULT_SETTINGS.mode)
          .onChange(async (value) => {
            this.plugin.settings.mode =
              (value as Mode) || DEFAULT_SETTINGS.mode;
            await this.plugin.saveSettings();
            this.plugin.statusBar.setText(`Paste Mode: ${this.plugin.settings.mode}`);
          })
      );

    new Setting(containerEl)
      .setName("Blockquote Prefix")
      .setDesc(
        "Markdown syntax to signify that a line is part of a blockquote."
      )
      .addText((text) =>
        text
          .setPlaceholder(">•")
          .setValue(
            this.plugin.settings.blockquotePrefix ===
              DEFAULT_SETTINGS.blockquotePrefix
              ? ""
              : this.plugin.settings.blockquotePrefix
          )
          .onChange(async (value) => {
            this.plugin.settings.blockquotePrefix =
              value !== "" ? value : DEFAULT_SETTINGS.blockquotePrefix;
            await this.plugin.saveSettings();
          })
      );
  }
}
