import { appDataDir } from "@tauri-apps/api/path";
import { exists, readFile, readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";

export class NoteUtils {
	static slugify(text: string): string {
		return text
				.toLowerCase()
				.trim()
				.normalize("NFD")
				.replace(/[^a-z0-9]+/g, "-") // Replaces non-alphanumeric characters with hyphens
				.replace(/^-+|-+$/g, "") // Removes leading/trailing hyphens
	}

	static shiftSelectedText(text: string, start: number, end: number, offset: number): string {
		const lines = text.split('\n');
		
		if (text == '' && offset == 1) return '\t'+text; // Quick indentation even when there is no text at all
		
		let charCount = 0;
		for (let i = 0; i < lines.length; i++) {
			const lineLength = lines[i].length + 1; // +1 because of \n (\n = 1 char)
			if (charCount + lineLength > start && (charCount < end || start == end)) { // In/outdent even if the line is only partially selected

				if (offset > 0) {
					lines[i] = '\t' + lines[i]; // TODO: Allow user to change how indentation works in settings
				} else if (offset < 0) {
					lines[i] = lines[i].replace('\t','');
				}
			}
			charCount += lineLength;
		}
		return lines.join('\n');
	}

	public static async getMarkdownFile(filename: string): Promise<string> {
		const dir = await appDataDir();
		const path = `${dir}/${filename}`;
		const content = await readTextFile(path);
		return content;
	}

	public static async writeMarkdownFile(filename: string, content: string): Promise<void> {
		const dir = await appDataDir();
		const path = `${dir}/${filename}.md`;
		//await writeTextFile(path, content);
	}

	public static async getBinaryFile(filename: string): Promise<ArrayBuffer> {
		const dir = await appDataDir();
		const path = `${dir}/${filename}`;
		const contentRaw = await readFile(filename);
		return contentRaw.buffer;
	}

	public static async writeBinaryFile(filename: string, content: Uint8Array): Promise<void> {
		const dir = await appDataDir();
		const path = `${dir}/${filename}.bin`;
		await writeFile(path, content);
	}

	public static async doesFileExist(filename: string): Promise<boolean> {
		const dir = await appDataDir();
		const path = `${dir}/${filename}`;
		const result = await exists(path);
		return result;
	}

	public static formatDate(date: Date): string {
		return `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')} ${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;

	}

}