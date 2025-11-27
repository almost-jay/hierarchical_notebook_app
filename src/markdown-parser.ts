export type NodeType =
    | 'plain'
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
    level?: number;            // for heading or blockquote nesting
    children?: ParsedNode[];
    syntax?: string;
}

interface Frame {
    type: NodeType;
    marker: string;
    start: number;
    children: ParsedNode[];
}

interface MarkerDef {
    marker: string;
    type: Exclude<NodeType, 'heading' | 'blockquote'>;
}

export class MarkdownParser {
	private preserveSyntax: boolean = false;
	private MARKERS: MarkerDef[] = [
		{ marker: '***', type: 'bolditalic' },
		{ marker: '==',  type: 'highlight' },
		{ marker: '**',  type: 'bold' },
		{ marker: '*',   type: 'italic' },
		{ marker: '_',   type: 'underline' },
		{ marker: '~~',  type: 'strikethrough' },
		{ marker: '`',   type: 'code' },
	];
	public constructor(preserveSyntax?:boolean) {
		this.preserveSyntax = preserveSyntax;
	}

	public parseLine(line: string): ParsedNode[] {
		const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
		if (headingMatch) {
			const level = headingMatch[1].length;
			const content = headingMatch[2];
			return [{
				type: 'heading',
				level,
				children: this.parseInline(content),
			}];
		}

		const blockquoteMatch = line.match(/^(>+)\s+(.*)$/);
		if (blockquoteMatch) {
			const level = blockquoteMatch[1].length;
			const content = blockquoteMatch[2];
			return [{
				type: 'blockquote',
				level,
				children: this.parseInline(content),
			}];
		}

		return this.parseInline(line);
	}

	public parseInline(line: string): ParsedNode[] {
		const root: Frame = { type: 'plain', marker: '', start: 0, children: [] };
		const stack: Frame[] = [root];
		let buffer = '';
		let i = 0;

		const flushBuffer = (): void => {
			if (buffer) {
				stack[stack.length - 1].children.push({ type: 'plain', text: buffer });
				buffer = '';
			}
		};

		while (i < line.length) {
			if (line[i] === '\\' && i + 1 < line.length) {
				buffer += line[i + 1];
				i += 2;
				continue;
			}

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

			if (top.marker === marker) {
				flushBuffer();
				const frame = stack.pop()!;
				const node: ParsedNode = {
					type: frame.type,
					children: frame.children,
				};
				if (this.preserveSyntax)
					node.syntax = line.slice(frame.start, i + marker.length);
				stack[stack.length - 1].children.push(node);
				i += marker.length;
				continue;
			}

			flushBuffer();
			stack.push({ type, marker, start: i, children: [] });
			i += marker.length;
		}

		flushBuffer();

		while (stack.length > 1) {
			const unclosed = stack.pop()!;
			const text = line.slice(unclosed.start);
			stack[stack.length - 1].children.push({
				type: 'plain',
				text: this.preserveSyntax ? text : text.slice(unclosed.marker.length),
			});
		}

		return root.children;
	}

	public renderHTML(nodes: ParsedNode[]): string {
		return nodes.map(node => this.renderNode(node)).join('');
	}

	private renderNode(node: ParsedNode): string {
		if (node.type === 'plain') return this.escapeHTML(node.text ?? '');

		const inner = (node.children ?? []).map(c => this.renderNode(c)).join('');

		switch (node.type) {
		case 'italic':        return `<em>${inner}</em>`;
		case 'bold':          return `<strong>${inner}</strong>`;
		case 'bolditalic':    return `<strong><em>${inner}</em></strong>`;
		case 'underline':     return `<u>${inner}</u>`;
		case 'strikethrough': return `<del>${inner}</del>`;
		case 'highlight':     return `<mark>${inner}</mark>`;
		case 'code':          return `<code>${this.escapeHTML(inner)}</code>`;
		case 'heading':       return `<h${node.level}>${inner}</h${node.level}>`;
		case 'blockquote': {
			let html = inner;
			for (let i = 0; i < (node.level ?? 1); i++) {
				html = `<blockquote>${html}</blockquote>`;
			}
			return html;
		}
		default: return inner;
		}
	}

	private escapeHTML(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}
}
