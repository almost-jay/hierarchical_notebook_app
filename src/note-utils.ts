import { appDataDir, BaseDirectory, join } from "@tauri-apps/api/path";
import { exists, readFile, readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";

export class NoteUtils {
	static slugify(text: string): string {
		const maxLength = 60;
		let slug = text
			.toLowerCase()
			.trim()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");

		if (slug.length <= maxLength) return slug;

		const cutoff = slug.lastIndexOf("-", maxLength);
		if (cutoff > 0) {
			return slug.slice(0, cutoff);
		}

		return slug.slice(0, maxLength);
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
		const content = await readTextFile(`${filename}.md`, { baseDir: BaseDirectory.AppData } );
		return content;
	}

	public static async writeMarkdownFile(filename: string, content: string): Promise<void> {
		await writeTextFile(`${filename}.md`, content, { baseDir: BaseDirectory.AppData } );
	}

	public static async getBinaryFile(filename: string): Promise<ArrayBuffer> {
		const contentRaw = await readFile(`${filename}.bin`, { baseDir: BaseDirectory.AppData } );
		return contentRaw.buffer;
	}

	public static async writeBinaryFile(filename: string, content: Uint8Array): Promise<void> {
		await writeFile(`${filename}.bin`, content, { baseDir: BaseDirectory.AppData } );
	}

	public static async doesFileExist(filename: string): Promise<boolean> {
		const result = await exists(filename, { baseDir: BaseDirectory.AppData });
		return result;
	}

	public static formatDate(date: Date): string {
		return `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')} ${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;

	}

}