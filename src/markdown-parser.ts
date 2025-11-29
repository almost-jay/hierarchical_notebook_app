export type NodeType =
    | 'plain'
	| 'line'
	| 'image'
    | 'italic'
    | 'bold'
    | 'bolditalic'
    | 'underline'
    | 'strikethrough'
    | 'highlight'
    | 'code'
    | 'heading'
    | 'blockquote';

export interface ParsedNode {
    type: NodeType;
    text?: string;
	src?: string;
    level?: number; // for heading / blockquote
    children?: ParsedNode[];
    // If preserveSyntax is enabled, syntaxOpen/syntaxClose contain the marker strings.
    // For headings/blockquotes only syntaxOpen is used (opening only).
    syntaxOpen?: string;
    syntaxClose?: string;
}

interface Frame {
    type: NodeType;
    marker: string;   // the marker text, e.g. "*", "**", "==", "`", "***"
    start: number;    // index in the line where marker started
    children: ParsedNode[];
}

interface MarkerDef {
    marker: string;
    type: Exclude<NodeType, 'heading' | 'blockquote'>;
}

const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/y;

export class MarkdownParser {
	private MARKERS: MarkerDef[] = [
		{ marker: '***', type: 'bolditalic' },
		{ marker: '==',  type: 'highlight' },
		{ marker: '**',  type: 'bold' },
		{ marker: '*',   type: 'italic' },
		{ marker: '_',   type: 'underline' },
		{ marker: '~~',  type: 'strikethrough' },
		{ marker: '`',   type: 'code' },
	];
	public constructor () {}

	// Parse a full line: check headings & blockquotes first, otherwise inline
	public parseLine(line: string): ParsedNode[] {
		const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
		if (headingMatch) {
			const level = headingMatch[1].length;
			const content = headingMatch[2];
			const children = this.parseInline(content);
			const node: ParsedNode = {
				type: 'heading',
				level,
				children,
			};
			//if (preserveSyntax) node.syntaxOpen = headingMatch[1] + ' ';
			return [node];
		}

		const blockquoteMatch = line.match(/^(>+)\s+(.*)$/);
		if (blockquoteMatch) {
			const level = blockquoteMatch[1].length;
			const content = blockquoteMatch[2];
			const children = this.parseInline(content);
			const node: ParsedNode = {
				type: 'blockquote',
				level,
				children,
			};
			//if (preserveSyntax) node.syntaxOpen = blockquoteMatch[1] + ' ';
			return [node];

			
		}
		
		const result = this.parseInline(line);
		return result;
	}

	// Parse inline into nested nodes using frames on a stack
	public parseInline(line: string): ParsedNode[] {
		const root: Frame = { type: 'plain', marker: '', start: 0, children: [] };
		const stack: Frame[] = [root];
		let buffer = '';
		let i = 0;

		const flushBuffer = (): void => {
			if (buffer.length > 0) {
				stack[stack.length - 1].children.push({ type: 'plain', text: buffer });
				buffer = '';
			}
		};



		while (i < line.length) {
			// --- Check for image ---
			IMAGE_REGEX.lastIndex = i; // start matching at current position
			const imgMatch = IMAGE_REGEX.exec(line);
			if (imgMatch && imgMatch.index === i) {
				flushBuffer(); // push any accumulated text

				const [fullMatch, altText, srcPath]: string[] = imgMatch;

				const imgNode: ParsedNode = {
					type: 'image',
					text: altText,
					src: srcPath,
				};

				stack[stack.length - 1].children.push(imgNode);

				i += fullMatch.length; // advance past the image syntax
				continue;
			}


			// single-backslash escape: consume backslash and append next char literally
			if (line[i] === '\\' && i + 1 < line.length) {
				buffer += line[i + 1];
				i += 2;
				continue;
			}

			// match markers longest-first
			let matched: MarkerDef | null = null;
			for (const m of this.MARKERS) {
				if (line.startsWith(m.marker, i)) {
					matched = m;
					break;
				}
			}

			if (!matched) {
				buffer += line[i];
				i++;
				continue;
			}

			const { marker, type }: MarkerDef = matched;
			const top = stack[stack.length - 1];

			// closing marker? (top.marker equals this marker)
			if (top.marker === marker) {
				// flush any buffered text into current frame (text inside this frame)
				flushBuffer();

				// pop the frame and create a node from its children
				const frame = stack.pop()!;
				const node: ParsedNode = {
					type: frame.type,
					children: frame.children,
				};

				// if (preserveSyntax) {
				// 	// opening marker string is the same as the marker, but we
				// 	// also capture literal closing marker (which is the same).
				// 	// We can reconstruct open/close by using the marker text.
				// 	node.syntaxOpen = marker;
				// 	node.syntaxClose = marker;
				// }

				// append node to parent frame children
				stack[stack.length - 1].children.push(node);

				i += marker.length;
				continue;
			}

			// Otherwise: opening marker.
			// flush buffer into current frame only if outside other frames (or generally,
			// we flush buffer into the current top frame so it's attributed correctly)
			flushBuffer();

			// push a new frame on stack (start marks where the opening marker begins)
			stack.push({ type, marker, start: i, children: [] });
			i += marker.length;
			continue;
		}

		// end-of-line: flush remaining buffer into current frame
		flushBuffer();

		// Any unclosed frames become literal plain text in the parent frame.
		// We must include the original marker + the inner content (preserveSyntax controls whether to include the marker text or slice it off)
		while (stack.length > 1) {
			const unclosed = stack.pop()!;
			const originalText = line.slice(unclosed.start); // from opening marker to line end
			stack[stack.length - 1].children.push({
				type: 'plain',
				text : originalText.slice(unclosed.marker.length),
				//text: preserveSyntax ? originalText : originalText.slice(unclosed.marker.length),
			});
		}

		return root.children;
	}

	// Render a tree of ParsedNode to HTML. When preserveSyntax is true, include
	// the syntax markers wrapped in <span class="md-syntax">...</span>.
	public renderHTML(nodes: ParsedNode[]): string {
		return nodes.map(n => this.renderNode(n)).join('');
	}

	private escapeHTML(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			//.replace(/<(?!br\s*\/?>)/g, '&lt;')
			.replace(/>/g, '&gt;')
			//.replace(/(?<!<br\s*\/?)>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	private renderNode(node: ParsedNode): string {
		if (node.type === 'plain') {
			return this.escapeHTML(node.text ?? '');
		}

		// render children first
		const inner = (node.children ?? []).map(c => this.renderNode(c)).join('');

		// if preserving syntax, emit opening syntax span, then inner, then closing span
		const emitWithSyntax = (open?: string, close?: string, body = inner): string => {
			return body;
			// const openHtml = open ? `<span class="markdown-syntax">${this.escapeHTML(open)}</span>` : '';
			// const closeHtml = close ? `<span class="markdown-syntax">${this.escapeHTML(close)}</span>` : '';
			// return `${openHtml}${body}${closeHtml}`;
		};

		switch (node.type) {
		case 'italic':
			return emitWithSyntax(node.syntaxOpen, node.syntaxClose, `<em>${inner}</em>`);
		case 'bold':
			return emitWithSyntax(node.syntaxOpen, node.syntaxClose, `<strong>${inner}</strong>`);
		case 'bolditalic':
			// render as nested strong+em inside the syntax wrappers
			return emitWithSyntax(node.syntaxOpen, node.syntaxClose, `<strong><em>${inner}</em></strong>`);
		case 'underline':
			return emitWithSyntax(node.syntaxOpen, node.syntaxClose, `<u>${inner}</u>`);
		case 'strikethrough':
			return emitWithSyntax(node.syntaxOpen, node.syntaxClose, `<del>${inner}</del>`);
		case 'highlight':
			return emitWithSyntax(node.syntaxOpen, node.syntaxClose, `<mark>${inner}</mark>`);
		case 'code':
			// code should escape inner content too
			return emitWithSyntax(node.syntaxOpen, node.syntaxClose, `<code>${this.escapeHTML(inner)}</code>`);
		case 'heading': {
			const level = node.level ?? 1;

			// inner content of the heading
			const body = inner;

			// if (preserveSyntax && node.syntaxOpen) {
			// 	const syntaxSpan = `<span class="markdown-syntax">${this.escapeHTML(node.syntaxOpen)}</span>`;
			// 	return `<h${level}>${syntaxSpan}${body}</h${level}>`;
			// }

			return `<h${level}>${body}</h${level}>`;
		}

		case 'blockquote': {
			// blockquotes are nested <blockquote>…</blockquote> for each level
			const body = inner;

			// if (preserveSyntax && node.syntaxOpen) {
			// 	const syntaxSpan = `<span class="markdown-syntax">${this.escapeHTML(node.syntaxOpen)}</span>`;
			// 	body = `${syntaxSpan}${body}`;
			// }

			let level = node.level ?? 1;
			let html = body;

			while (level-- > 0) {
				html = `<blockquote>${html}</blockquote>`;
			}

			return html;
		}
		case 'image':
			return `<img data-srcpath="${this.escapeHTML(node.src!)}" alt="${this.escapeHTML(node.text!)}">`;

		default:
			return inner;
		}
	}
}