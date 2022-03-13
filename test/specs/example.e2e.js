const { assert } = require("chai");
const fs = require("fs");
const path = require('path');


// Note: Supported keyboard key names can be found here:
// https://w3c.github.io/webdriver/webdriver-spec.html#keyboard-actions

async function sleep(seconds) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

describe("Plugin", function () {
    this.timeout(60 * 1000);

    this.beforeAll(async function () {
        await browser;

        // These steps are from
        // https://github.com/trashhalo/obsidian-plugin-e2e-test/blob/master/test/spec.js :

        // Open the vault, avoiding working with a File Chooser modal:
        await browser.execute(
            "require('electron').ipcRenderer.sendSync('vaultOpen', 'test/empty_vault', false)"
        );
        await sleep(2);

        // Disable safemode and enable the plugin:
        await browser.execute(
            "app.plugins.setEnable(true);app.plugins.enablePlugin('obsidian-paste-to-current-indentation')"
        );

        // Dismiss warning model:
        await browser.$(".modal-button-container button:last-child").click();
        await sleep(0.5);

        // Exit settings:
        await browser.$(".modal-close-button").click();
    })

    beforeEach(async function () {
        await browser;
        // Create a new file:
        await browser.$('.workspace').keys(['Control', 'n']);
    });

    afterEach(async function () {
        await browser;
        await browser.keys(['Escape']);  // Close any open dialog box.
        await sleep(0.5);
        await browser.keys(['Control', 'p']);  // Open the Command Palette
        await sleep(0.5);
        await browser.$(".prompt-input").keys("Delete current file");
        await sleep(0.5);
        await browser.$(".suggestion-item.is-selected").click();
        await sleep(1);
        await browser.$$('.mod-warning')[1].click();
        await sleep(1);
    });

    it("adds commands", async function () {
        await browser.$('.view-content').keys(['Control', 'p']);
        await sleep(0.5);
        await browser.$(".prompt-input").keys("Paste to Current Indentation");
        const commands = (await browser.$$(".suggestion-item")).length;
        assert(commands === 10, 'Wrong number of commands in Command Palette');
    });

    it("correctly pastes in text mode", async function () {
        const testText = `- Lorem ipsum 1
    - Lorem ipsum 2
        - Lorem ipsum 3
    - Lorem ipsum 4`;

        fs.writeFileSync(path.join('test', 'empty_vault', 'Untitled.md'), testText);
        await sleep(1);

        // Check the contents of the clipboard:
        await $('.view-content').click({ button: "right" });
        await sleep(1);
        await $$('.menu-item')[4].click(); // "Select all"

        await $('.view-content').click({ button: "right" });
        await sleep(1);
        await $$('.menu-item')[2].click(); // "Cut"

        await browser.$('.view-content').keys(['Control', 'p']);
        await sleep(1);
        await browser.$(".prompt-input").keys("Paste to Current Indentation: Set Paste Mode to Text");
        await browser.$(".suggestion-item").click();
        await sleep(1);

        await $('.view-content').click({ button: "right" });
        await sleep(1);
        await $$('.menu-item')[4].click(); // "Paste"

        await sleep(2);

        const pastedText = await $('.view-content').getText();

        console.log('Input text:')
        console.log(testText)
        console.log('Pasted text:')
        console.log(pastedText)

        const testTextSplit = testText.split(/\r?\n/);
        const pastedTextSplit = pastedText.split(/\r?\n/);

        assert(pastedTextSplit[1].trim() == testTextSplit[1].trim(), `Line 1 ("${pastedTextSplit[1]}") is not as expected ("${testTextSplit[1]}")`);
    });

    it("correctly pastes in text blockquote mode", async function () {
        const testText = `- Lorem ipsum 1
    - Lorem ipsum 2
        - Lorem ipsum 3
    - Lorem ipsum 4`;

        fs.writeFileSync(path.join('test', 'empty_vault', 'Untitled.md'), testText);
        await sleep(3);

        // Check the contents of the clipboard:
        await $('.view-content').click({ button: "right" });
        await sleep(1);
        await $$('.menu-item')[4].click(); // "Select all"
        // await $('.view-content').click();
        // await sleep(1);
        // await browser.$('.view-content').keys(['Control', 'a']);

        await $('.view-content').click({ button: "right" });
        await sleep(1);
        await $$('.menu-item')[2].click(); // "Cut"
        // await browser.$('.view-content').keys(['Control', 'x']);

        await browser.$('.view-content').keys(['Control', 'p']);
        await sleep(1);
        await browser.$(".prompt-input").keys("Paste to Current Indentation: Set Paste Mode to Text (Blockquote)");
        await browser.$(".suggestion-item").click();
        await sleep(1);

        await $('.view-content').click({ button: "right" });
        await sleep(1);
        await $$('.menu-item')[3].click(); // "Paste"
        // await browser.$('.view-content').keys(['Control', 'v']);

        await sleep(1);

        const pastedText = await $('.view-content').getText();

        console.log('Input text:')
        console.log(testText)
        console.log('Pasted text:')
        console.log(pastedText)

        const testTextSplit = testText.split(/\r?\n/);
        const pastedTextSplit = pastedText.split(/\r?\n/);

        assert(pastedTextSplit[1].trim() == `> ${testTextSplit[1]}`.trim(), `Line 1 ("${pastedTextSplit[1]}") is not as expected ("> ${testTextSplit[1]}")`);
    });
});