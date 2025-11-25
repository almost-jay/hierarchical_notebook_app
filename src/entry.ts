const ENTRY_BINARY_FORMAT  = {
	ID_OFFSET: 0,
	GROUP_ID_OFFSET: 2,
	QUOTED_ID_OFFSET: 4,
	INDENT_LEVEL_OFFSET: 6,
	IS_PINNED_OFFSET: 7,
	CREATED_OFFSET: 8,
	LAST_EDITED_OFFSET: 16,
	TEXT_LENGTH_OFFSET: 24,

	HEADER_SIZE: 26,
} as const;

export class Entry {
	public id: number;
	public groupId: number;
	public text: string;
	public created: Date;
	public indentLevel: number;
	public isPinned: boolean = false;
	public quotedId?: number;
	public lastEdited?: Date;

	public constructor(id: number, groupId: number, text: string, created: Date, indentLevel: number, isPinned?: boolean, lastEdited?: Date, quotedId?: number) {
		this.id = id;
		this.groupId = groupId;
		this.text = text;
		this.created = created;
		this.indentLevel = indentLevel;
		if (isPinned) this.isPinned = isPinned;
		if (quotedId) if (quotedId != 65535) this.quotedId = quotedId; // Because the binary storage system encodes an undefined quotedId as 1111..., it will be parsed to decimal as 65535
		if (lastEdited) if (lastEdited.getTime() != new Date(0).getTime())this.lastEdited = lastEdited; // Similarly, an undefined lastEdited is stored as 0000... (because 1111... would be too large for JS to handle)
	}

	public static fromPartial(partial: Partial<Entry> & { id: number; groupId: number; text: string; created: Date; indentLevel: number }): Entry {
		return new Entry(
			partial.id,
			partial.groupId,
			partial.text,
			partial.created,
			partial.indentLevel,
			partial.isPinned,
			partial.lastEdited,
			partial.quotedId,
		);
	}

	public static fromBinary(file: ArrayBuffer): Entry {
		const dataView = new DataView(file)
		const id = dataView.getUint16(ENTRY_BINARY_FORMAT.ID_OFFSET);
		const groupId = dataView.getUint16(ENTRY_BINARY_FORMAT.GROUP_ID_OFFSET);
		const quotedId = dataView.getUint16(ENTRY_BINARY_FORMAT.QUOTED_ID_OFFSET);
		const indentLevel = dataView.getUint8(ENTRY_BINARY_FORMAT.INDENT_LEVEL_OFFSET);
		const isPinned = dataView.getUint8(ENTRY_BINARY_FORMAT.IS_PINNED_OFFSET) == 1;
		const created = new Date(Number(dataView.getBigUint64(ENTRY_BINARY_FORMAT.CREATED_OFFSET)));
		const lastEdited = new Date(Number(dataView.getBigUint64(ENTRY_BINARY_FORMAT.LAST_EDITED_OFFSET)));
		const textLength = dataView.getUint16(ENTRY_BINARY_FORMAT.TEXT_LENGTH_OFFSET);
		const text = new TextDecoder('utf-8').decode(file.slice(ENTRY_BINARY_FORMAT.HEADER_SIZE, ENTRY_BINARY_FORMAT.HEADER_SIZE + textLength)); // ? Should this be split across multiple lines

		return new Entry(id, groupId, text, created, indentLevel, isPinned, lastEdited, quotedId);
	}

	public toBinary(): ArrayBuffer {
		const textBytes = new TextEncoder().encode(this.text);
		const textLength = textBytes.byteLength;
		
		const buffer = new ArrayBuffer(25 + textLength);
		const dataView = new DataView(buffer);

		dataView.setUint16(ENTRY_BINARY_FORMAT.ID_OFFSET, this.id);
		dataView.setUint16(ENTRY_BINARY_FORMAT.GROUP_ID_OFFSET, this.groupId);
		dataView.setUint16(ENTRY_BINARY_FORMAT.QUOTED_ID_OFFSET, this.quotedId !== undefined ? this.quotedId : 0xFFFF); // can maybe get rid of "!== undefined "
		dataView.setUint8(ENTRY_BINARY_FORMAT.INDENT_LEVEL_OFFSET, this.indentLevel);
		dataView.setUint8(ENTRY_BINARY_FORMAT.IS_PINNED_OFFSET, this.isPinned ? 1 : 0);
		dataView.setBigUint64(ENTRY_BINARY_FORMAT.CREATED_OFFSET, BigInt(this.created.getTime()));
		dataView.setBigUint64(ENTRY_BINARY_FORMAT.LAST_EDITED_OFFSET, this.lastEdited ? BigInt(this.lastEdited.getTime()) : 0n);
		dataView.setUint16(ENTRY_BINARY_FORMAT.TEXT_LENGTH_OFFSET, textLength); 
		
		new Uint8Array(buffer, ENTRY_BINARY_FORMAT.HEADER_SIZE, textLength).set(textBytes);
		
		return buffer;
	}
}