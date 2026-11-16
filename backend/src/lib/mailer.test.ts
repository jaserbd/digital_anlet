import { describe, expect, it } from 'vitest';
import { renderEmail } from './mailer';

describe('renderEmail', () => {
  it('escapes every value and keeps a plain-text alternative', () => {
    const { html, text } = renderEmail({
      subject: 's',
      heading: 'Hi <b>there</b>',
      paragraphs: ['Tom & "Jerry" <script>alert(1)</script>'],
      button: { label: 'Go', url: 'https://example.com/reset?token=a&b="x"' },
      footnote: 'Ignore <this>',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>there</b>');
    expect(html).toContain('Tom &amp; &quot;Jerry&quot; &lt;script&gt;');
    expect(html).toContain('href="https://example.com/reset?token=a&amp;b=&quot;x&quot;"');
    expect(text).toContain('Go: https://example.com/reset?token=a&b="x"');
    expect(text).toContain('Ignore <this>');
  });

  it('never turns a non-http(s) link into a button', () => {
    const { html, text } = renderEmail({
      subject: 's',
      heading: 'h',
      paragraphs: [],
      button: { label: 'Click', url: 'javascript:alert(1)' },
    });
    expect(html).not.toContain('javascript:');
    expect(text).not.toContain('javascript:');
  });
});
