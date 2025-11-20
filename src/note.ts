import { Entry } from "./entry";
import { NoteUtils } from "./note-utils";

export class Note {
	id: string; // Slugified version of title
	title: string; // 
	persistentText: string;
	entries: Entry[] = [];
	created: Date;
	isUnsaved: boolean;

	constructor(title: string) {
		this.title = title;
		this.id = NoteUtils.slugify(title);
	}

	public async loadFromFile(): Promise<void> {
		const persistentFileName = `${this.title}-persistent.md`;
		const entriesFileName = `${this.title}-entries.bin`;
		if(NoteUtils.doesFileExist(persistentFileName)) {
			this.persistentText = await NoteUtils.getMarkdownFile(persistentFileName);
			
			if (NoteUtils.doesFileExist(entriesFileName)) {
				const entryFile = await NoteUtils.getBinaryFile(entriesFileName);
				const dataView = new DataView(entryFile);
				let i = 0;
				while (i < entryFile.byteLength) {
					const id = dataView.getUint16(0);
					const groupId = dataView.getUint16(2);
					const quotedId = dataView.getUint16(4);
					const indentLevel = dataView.getUint8(6);
					const created = new Date(Number(dataView.getBigUint64(7)));
					const lastEdited = new Date(Number(dataView.getBigUint64(16)));
					const textLength = dataView.getUint16(23);
					const text = new TextDecoder("utf-8").decode(entryFile.slice(textLength)); // ? Should this be split across multiple lines

					this.entries.push(new Entry(id, groupId, text, created, indentLevel, lastEdited, quotedId));
					i += 25 + textLength;
				}
			} else {
				console.error(`Could not find entries file ${entriesFileName}!`);
			}
		} else {
			console.error(`Could not find markdown file ${persistentFileName}!`);
		}
	}

	async save() {
		// Write to filepath for both entries and persistent
		const persistentFileName = `${this.title}-persistent.md`;
		const entriesFileName = `${this.title}-entries.bin`;

		const buffers: ArrayBuffer[] = this.entries.map(e => e.toBinary());
		const totalLength = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);

		const entriesAsBinary = new Uint8Array(totalLength); // ArrayBuffer can't be directly concatenated, so we put a Uint8Array over it

		let offset = 0;
		for (const buffer of buffers) {
			entriesAsBinary.set(new Uint8Array(buffer), offset);
			offset += buffer.byteLength;
		}

		await NoteUtils.writeMarkdownFile(persistentFileName, this.persistentText);
		await NoteUtils.writeBinaryFile(entriesFileName, entriesAsBinary);
		

	}


	load() {
		
		// Get file from filepath for both entries and persistent
		

	}
	
	public addEntry(newEntry: Entry): void {
		this.entries.push(newEntry);
	}

	public updateEntry(targetEntryId: number, newText: string) {
		// this.entries[id].text = newText
	}
	
}
