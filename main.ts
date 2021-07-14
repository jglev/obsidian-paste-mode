import { App, MarkdownView, Modal, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		console.log('Loading paste-to-current-indentation');

		await this.loadSettings();

		// this.addRibbonIcon('dice', 'Sample Plugin', () => {
		// 	new Notice('This is a notice!');
		// });

		// this.addStatusBarItem().setText('Status Bar Text');

		// this.addCommand({
		// 	id: 'open-sample-modal',
		// 	name: 'Open Sample Modal',
		// 	// callback: () => {
		// 	// 	console.log('Simple Callback');
		// 	// },
		// 	checkCallback: (checking: boolean) => {
		// 		let leaf = this.app.workspace.activeLeaf;
		// 		if (leaf) {
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}
		// 			return true;
		// 		}
		// 		return false;
		// 	}
		// });

		this.addCommand({
			id: 'paste-text-to-current-indentation',
			name: 'Paste text to current indentation',
			checkCallback: (checking: boolean) => {
				let view = this.app.workspace.activeLeaf.view;
				if (view) {
					if (!checking && view instanceof MarkdownView) {
						console.log('Pasting...');
						this.pasteText(view);
					}
					return true;
				}
				return false;
			}
		});

		// this.addCommand({
		// 	id: 'paste-blockquote-to-current-indentation',
		// 	name: 'Paste blockquote to current indentation',
		// 	// callback: () => {
		// 	// 	console.log('Simple Callback');
		// 	// },
		// 	checkCallback: (checking: boolean) => {
		// 		let leaf = this.app.workspace.activeLeaf;
		// 		if (leaf) {
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}
		// 			return true;
		// 		}
		// 		return false;
		// 	}
		// });

		// this.addSettingTab(new SampleSettingTab(this.app, this));

		// this.registerCodeMirror(async (cm: CodeMirror.Editor) => {
		// 	console.log('codemirror', cm);
		// 	console.log('Permissions:', navigator.permissions);
		// 	var clipboardText = await navigator.clipboard
		// 	console.log('Text:', clipboardText);
		// });

		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });

		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	async pasteText(view: MarkdownView) {
		const clipboardText = await navigator.clipboard.readText();
		if (clipboardText !== '') {
			console.log(95, clipboardText);
			const currentLineNumber = view.sourceMode.editor.getCursor().line;
			const currentLineText = view.sourceMode.editor.getLine(currentLineNumber);
			const leadingWhitespace = currentLineText.match(/^(\s*).*/)[1];
			console.log(97, leadingWhitespace);
			const clipboardTextIndented = clipboardText.replaceAll(
				/\n/, `\n${leadingWhitespace}`);
			console.log(102, clipboardTextIndented);
			view.sourceMode.editor.setLine(
				currentLineNumber, currentLineText + clipboardTextIndented);

			return;
		}

		console.log('Nothing to paste from the clipboard!')
	}

	// onunload() {
	// 	console.log('unloading plugin');
	// }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue('')
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
