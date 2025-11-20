export class Entry {
	id: number;
	groupId: number;
	text: string;
	created: Date;
	indentLevel: number;
	quotedId?: number;
	lastEdited?: Date;

	constructor(id: number, groupId: number, text: string, created: Date, indentLevel: number, lastEdited?: Date, quotedId?: number) {
		this.id = id;
		this.groupId = groupId;
		this.text = text;
		this.created = created;
		this.indentLevel = indentLevel;
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
			partial.lastEdited,
            partial.quotedId,
        );
    }

	public toBinary(): ArrayBuffer {
		const textBytes = new TextEncoder().encode(this.text);
		const textLength = textBytes.byteLength;
		
		const buffer = new ArrayBuffer(25 + textLength);
		const dataView = new DataView(buffer);

		dataView.setUint16(0, this.id);
		dataView.setUint16(2, this.groupId);
		dataView.setUint16(4, this.quotedId !== undefined ? this.quotedId : 0xFFFF); // can maybe get rid of "!== undefined "
		dataView.setUint8(6, this.indentLevel);
		dataView.setBigUint64(7, BigInt(this.created.getTime()));
		dataView.setBigUint64(16, this.lastEdited ? BigInt(this.lastEdited.getTime()) : 0n);
		dataView.setUint16(23, textLength); 
		
		new Uint8Array(buffer, 25, textLength).set(textBytes);
		
		return buffer;
	}
}