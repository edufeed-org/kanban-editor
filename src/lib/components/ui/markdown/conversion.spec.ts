import { describe, expect, it } from 'vitest';

import { htmlToMarkdown, isFullyHtml, markdownToHtml } from './conversion.js';

describe('markdown conversion helpers', () => {
	it('preserves paragraph breaks for plain multiline text when loading the editor', () => {
		const content = 'Das ist ein Absatz.\n\nDas ist die naechste Zeile';

		const html = markdownToHtml(content);

		expect(html).toContain('<p>Das ist ein Absatz.</p>');
		expect(html).toContain('<p>Das ist die naechste Zeile</p>');
	});

	it('preserves paragraph spacing when converting editor html back to markdown', () => {
		const html = '<p>Das ist ein Absatz.</p><p>Das ist die naechste Zeile</p>';

		expect(htmlToMarkdown(html)).toBe('Das ist ein Absatz.\n\nDas ist die naechste Zeile');
	});

	it('keeps full html content untouched', () => {
		const html = '<p>Bereits <strong>formatiert</strong></p>';

		expect(isFullyHtml(html)).toBe(true);
		expect(markdownToHtml(html)).toBe(html);
	});
});