import { MarkdownView } from '../__mocks__/obsidian';

describe('Examining mocks', () => {
  const view = new MarkdownView(
    [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'Sed venenatis lectus et leo viverra, ac viverra purus rutrum.',
      '',
      'Etiam semper massa ut est faucibus, eu luctus arcu porttitor.'
    ],
    {line: 0, ch: 0},
    {line: 0, ch: 0}
  );

  test('correctly creates a mock view', () => {
    // console.log(`"${JSON.stringify(view)}`);
    expect(JSON.stringify(view)).toEqual('{"editor":{"content":["Lorem ipsum dolor sit amet, consectetur adipiscing elit.","Sed venenatis lectus et leo viverra, ac viverra purus rutrum.","","Etiam semper massa ut est faucibus, eu luctus arcu porttitor."],"selection":[{"line":0,"ch":0},{"line":0,"ch":0}]}}');
  });
});
