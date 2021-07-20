import * as obsidian from "obsidian";

// Following https://stackoverflow.com/a/52366601,
// get Jest to understand that our mock of
// MarkdownView is quite different in its type
// definition from the actual obsidian MarkdownView
// (in that ours just implements some of the real
// class' methods):
const MarkdownView = <jest.Mock>obsidian.MarkdownView;

import { toggleQuote } from "../src/toggle-quote";

const defaultViewSettings = {
  content: [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Sed venenatis lectus et leo viverra, ac viverra purus rutrum.",
    "",
    "Etiam semper massa ut est faucibus, eu luctus arcu porttitor.",
  ],
  selectionStart: { line: 0, ch: 0 },
  selectionEnd: { line: 0, ch: 0 },
};

const defaultPrefix = "> ";

describe("Examining toggle-blockquote-at-current-indentation", () => {
  // beforeAll(() => {
  // });

  test("Adds and removes blockquote from single line with cursor at beginning of line", async () => {
    const view = new MarkdownView(...Object.values(defaultViewSettings));

    expect(JSON.stringify(view)).toEqual(
      '{"editor":{"content":["Lorem ipsum dolor sit amet, consectetur adipiscing elit.","Sed venenatis lectus et leo viverra, ac viverra purus rutrum.","","Etiam semper massa ut est faucibus, eu luctus arcu porttitor."],"selection":[{"line":0,"ch":0},{"line":0,"ch":0}]}}'
    );

    await toggleQuote(view, defaultPrefix);
    expect(JSON.stringify(view)).toEqual(
      '{"editor":{"content":["> Lorem ipsum dolor sit amet, consectetur adipiscing elit.","Sed venenatis lectus et leo viverra, ac viverra purus rutrum.","","Etiam semper massa ut est faucibus, eu luctus arcu porttitor."],"selection":[{"line":0,"ch":2},{"line":0,"ch":2}]}}'
    );

    await toggleQuote(view, defaultPrefix);
    expect(JSON.stringify(view)).toEqual(
      '{"editor":{"content":["Lorem ipsum dolor sit amet, consectetur adipiscing elit.","Sed venenatis lectus et leo viverra, ac viverra purus rutrum.","","Etiam semper massa ut est faucibus, eu luctus arcu porttitor."],"selection":[{"line":0,"ch":0},{"line":0,"ch":0}]}}'
    );
  });

  test("Adds and removes blockquote from single line with cursor at middle of line", async () => {
    const view = new MarkdownView(
      defaultViewSettings.content,
      { line: 0, ch: 5 },
      { line: 0, ch: 5 }
    );

    expect(JSON.stringify(view)).toEqual(
      '{"editor":{"content":["Lorem ipsum dolor sit amet, consectetur adipiscing elit.","Sed venenatis lectus et leo viverra, ac viverra purus rutrum.","","Etiam semper massa ut est faucibus, eu luctus arcu porttitor."],"selection":[{"line":0,"ch":5},{"line":0,"ch":5}]}}'
    );

    await toggleQuote(view, defaultPrefix);
    expect(JSON.stringify(view)).toEqual(
      '{"editor":{"content":["> Lorem ipsum dolor sit amet, consectetur adipiscing elit.","Sed venenatis lectus et leo viverra, ac viverra purus rutrum.","","Etiam semper massa ut est faucibus, eu luctus arcu porttitor."],"selection":[{"line":0,"ch":7},{"line":0,"ch":7}]}}'
    );

    await toggleQuote(view, defaultPrefix);
    expect(JSON.stringify(view)).toEqual(
      '{"editor":{"content":["Lorem ipsum dolor sit amet, consectetur adipiscing elit.","Sed venenatis lectus et leo viverra, ac viverra purus rutrum.","","Etiam semper massa ut est faucibus, eu luctus arcu porttitor."],"selection":[{"line":0,"ch":5},{"line":0,"ch":5}]}}'
    );
  });

  test("Adds and removes blockquote from single line that begins with whitespace with cursor at beginning of line", async () => {
    const view = new MarkdownView(
      [
        '    ' + defaultViewSettings.content[0],
        ...defaultViewSettings.content.slice(1)
      ],
      { line: 0, ch: 10 },
      { line: 0, ch: 10 }
    );

    expect(JSON.stringify(view)).toEqual(
      '{"editor":{"content":["    Lorem ipsum dolor sit amet, consectetur adipiscing elit.","Sed venenatis lectus et leo viverra, ac viverra purus rutrum.","","Etiam semper massa ut est faucibus, eu luctus arcu porttitor."],"selection":[{"line":0,"ch":10},{"line":0,"ch":10}]}}'
    );

    await toggleQuote(view, defaultPrefix);
    expect(JSON.stringify(view)).toEqual(
      '{"editor":{"content":["    > Lorem ipsum dolor sit amet, consectetur adipiscing elit.","Sed venenatis lectus et leo viverra, ac viverra purus rutrum.","","Etiam semper massa ut est faucibus, eu luctus arcu porttitor."],"selection":[{"line":0,"ch":12},{"line":0,"ch":12}]}}'
    );

    await toggleQuote(view, defaultPrefix);
    expect(JSON.stringify(view)).toEqual(
      '{"editor":{"content":["    Lorem ipsum dolor sit amet, consectetur adipiscing elit.","Sed venenatis lectus et leo viverra, ac viverra purus rutrum.","","Etiam semper massa ut est faucibus, eu luctus arcu porttitor."],"selection":[{"line":0,"ch":10},{"line":0,"ch":10}]}}'
    );
  });
});
