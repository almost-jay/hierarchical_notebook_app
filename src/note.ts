import { Entry } from "./entry";

export class Note {
	id: string;
	title: string;
	text: string;
	entries: Entry[];
	persistentFilePath: string;
	entriesFilePath: string;
	persistentFile?: File;
	entriesFile?: File;

	constructor() {
		
	}

	load() {}
	save() {}
	addEntry() {}
	updateEntry() {}
	
}
