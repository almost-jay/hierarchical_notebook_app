interface ParseOptions {
  preserveSyntax?: boolean;
}

interface ParsedSegment {
  text: string;
  type: 'plain' | 'italic' | 'bold' | 'underline' | 'code' | 'strikethrough' | 'highlight' | 'heading' | 'blockquote';
  syntax?: string;
  level?: number;
}

export class MarkdownParser {
	private preserveSyntax: boolean;

	private INLINE_MARKERS: { marker: string; type: ParsedSegment['type'] }[] = [
		{ marker: '**', type: 'bold' },
		{ marker: '~~', type: 'strikethrough' },
		{ marker: '==', type: 'highlight' },
		{ marker: '*', type: 'italic' },
		{ marker: '_', type: 'underline' },
		{ marker: '`', type: 'code' },
	];

	public constructor(options: ParseOptions = {}) {
		this.preserveSyntax = options.preserveSyntax ?? false;
	}

	public parseLine(line: string): ParsedSegment[] {
		const segments: ParsedSegment[] = [];

		const headingMatch = line.match(/^(#{1,6})\s(.+)$/);
		if (headingMatch) {
			const level = headingMatch[1].length;
			segments.push({
				text: headingMatch[2],
				type: 'heading',
				level,
				syntax: this.preserveSyntax ? headingMatch[1] : undefined,
			});
			return segments;
		}

		const blockquoteMatch = line.match(/^(>+)\s(.+)$/);
		if (blockquoteMatch) {
			const level = blockquoteMatch[1].length;
			segments.push({
				text: blockquoteMatch[2],
				type: 'blockquote',
				level,
				syntax: this.preserveSyntax ? blockquoteMatch[1] : undefined,
			});
			return segments;
		}

    type StackItem = { type: ParsedSegment['type']; marker: string; start: number };
    const stack: StackItem[] = [];
    let buffer = '';
    let i = 0;

    while (i < line.length) {
    	let matchedMarker: { marker: string; type: ParsedSegment['type'] } | null = null;
    	for (const m of this.INLINE_MARKERS) {
    		if (line.slice(i, i + m.marker.length) === m.marker) {
    			matchedMarker = m;
    			break;
    		}
    	}

    	if (matchedMarker) {
    		const isEscaped = i > 0 && line[i - 1] === '\\';
    		if (isEscaped) {
    			buffer += matchedMarker.marker;
    			i += matchedMarker.marker.length;
    			continue;
    		}

    		const top = stack[stack.length - 1];

    		if (top && top.marker === matchedMarker.marker) {
    			const content = line.slice(top.start + matchedMarker.marker.length, i);
    			const segment: ParsedSegment = { text: content, type: matchedMarker.type };
    			if (this.preserveSyntax) {
    				segment.syntax = line.slice(top.start, i + matchedMarker.marker.length);
    			}
    			segments.push(segment);

    			stack.pop();
    			i += matchedMarker.marker.length;
    			buffer = '';
    			continue;
    		}

    		if (buffer && stack.length === 0) {
    			segments.push({ text: buffer, type: 'plain' });
    			buffer = '';
    		}

    		stack.push({ type: matchedMarker.type, marker: matchedMarker.marker, start: i });
    		i += matchedMarker.marker.length;
    		continue;
    	}

    	buffer += line[i];
    	i++;
    }

    if (buffer && stack.length === 0) {
    	segments.push({ text: buffer, type: 'plain' });
    	buffer = '';
    }
    while (stack.length > 0) {
    	const unclosed = stack.pop()!;
    	const segmentText = line.slice(unclosed.start);
    	segments.push({
    		text: this.preserveSyntax ? segmentText : segmentText.slice(unclosed.marker.length),
    		type: 'plain',
    	});
    }

    return segments;
	}


	public parseText(text: string): ParsedSegment[][] {
		return text.split('\n').map(line => this.parseLine(line));
	}

	public renderHTML(parsed: ParsedSegment[][]): string {
		const htmlLines = parsed.map(line => {
			if (line.length === 1) {
				const seg = line[0];
				if (seg.type === 'heading' && seg.level) {
					return `<h${seg.level}>${this.escapeHTML(seg.text)}</h${seg.level}>`;
				}
				if (seg.type === 'blockquote' && seg.level) {
					let content = this.escapeHTML(seg.text);
					for (let i = 0; i < seg.level; i++) {
						content = `<blockquote>${content}</blockquote>`;
					}
					return content;
				}
			}

			return line.map(seg => this.renderInlineHTML(seg)).join('');
		});

		return htmlLines.join('\n');
	}

	private renderInlineHTML(seg: ParsedSegment): string {
		const content = this.escapeHTML(seg.text);
		console.log(content);
		switch (seg.type) {
		case 'italic': return `<em>${content}</em>`;
		case 'bold': return `<strong>${content}</strong>`;
		case 'underline': return `<u>${content}</u>`;
		case 'strikethrough': return `<del>${content}</del>`;
		case 'highlight': 
			console.log(`highlight: <mark>${content}</mark>`);
			return `<mark>${content}</mark>`;
		case 'code': return `<code>${content}</code>`;
		case 'plain': 
			console.log(`plain: ${content}`);
			return content;
		case 'heading':
		case 'blockquote':
			console.log(`blockquote/heading: ${content}`);
			return content;
		default:
			console.log(`default: ${content}`);
			return content;
		}
	}

	private escapeHTML(text: string): string {
		return text.replace(/[&<>"']/g, (m) => {
			switch (m) {
			case '&': return '&amp;';
			case '<': return '&lt;';
			case '>': return '&gt;';
			case '"': return '&quot;';
			case "'": return '&#39;';
			default: return m;
			}
		});
	}

	public renderLineHTML(line: string): string {
		const segments = this.parseLine(line);

		// Check if the line is a single heading or blockquote
		if (segments.length === 1) {
			const seg = segments[0];
			if (seg.type === 'heading' && seg.level) {
				return `<h${seg.level}>${this.escapeHTML(seg.text)}</h${seg.level}>`;
			}
			if (seg.type === 'blockquote' && seg.level) {
				let content = this.escapeHTML(seg.text);
				for (let i = 0; i < seg.level; i++) {
					content = `<blockquote>${content}</blockquote>`;
				}
				return content;
			}
		}
		console.log(segments);
		let output = '';
		console.log('output: '+output);
		for (const seg of segments) {
			console.log('Segment:',seg);
			const rendered = this.renderInlineHTML(seg);
			console.log('Rendered HTML: ',rendered);
			output += rendered;
			console.log('Current output: '+output);
		}
		console.log('Final: '+output);
		return output;
	}


}
