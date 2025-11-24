import { BaseDirectory } from '@tauri-apps/api/path';
import { exists, readFile, readTextFile, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';

export class NoteUtils {
	public static slugify(text: string): string {
		const maxLength = 60;
		const slug = text
			.toLowerCase()
			.trim()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');

		if (slug.length <= maxLength) return slug;

		const cutoff = slug.lastIndexOf('-', maxLength);
		if (cutoff > 0) {
			return slug.slice(0, cutoff);
		}

		return slug.slice(0, maxLength);
	}


	public static shiftSelectedText(text: string, start: number, end: number, offset: number): string {
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

	public static async doesFileExist(filename: string): Promise<boolean> {
		const result = await exists(filename, { baseDir: BaseDirectory.AppData });
		return result;
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

	public static async doesCacheExist(filename: string): Promise<boolean> {
		const result = await exists(`${filename}.json`, { baseDir: BaseDirectory.AppCache });
		return result;
	}

	public static async readCache(filename: string): Promise<string> {
		const content = await readTextFile(`${filename}.json`, { baseDir: BaseDirectory.AppCache });
		return content;
	}

	public static async writeCache(filename: string, content: string): Promise<void> {
		await writeTextFile(`${filename}.json`, content, { baseDir: BaseDirectory.AppCache });
	}

	public static async doesConfigExist(filename: string): Promise<boolean> {
		const result = await exists(filename, { baseDir: BaseDirectory.AppConfig });
		return result;
	}

	public static async readConfig(filename: string): Promise<string> {
		const content = await readTextFile(`${filename}.json`, { baseDir: BaseDirectory.AppConfig });
		return content;
	}

	public static async writeConfig(filename: string, content: string): Promise<void> { // CHECK: UNUSED CURRENTLY
		await writeTextFile(`${filename}.json`, content, { baseDir: BaseDirectory.AppConfig });
	}

	public static startOfDay(date: Date): Date {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0); 
	}

	public static startOfDayString(date: string): string {
		return NoteUtils.formatDate(NoteUtils.startOfDay(new Date(date)));
	}

	public static startOfTodayString(): string { // CHECK: useless
		return NoteUtils.formatDate(NoteUtils.startOfDay(new Date()));
	}

	public static formatDateTime(date: Date): string {
		const result = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')} ${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
		return result;

	}

	public static formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		const day = date.getDate().toString().padStart(2, '0');
		console.log(`${year}-${month}-${day}`);
		return `${year}-${month}-${day}`;
	}

	public static countLeadingTabs(line: string, indentString: string): number {
		return line.match(new RegExp(`^${indentString}+`))?.[0].length || 0;

	}

	public static stripLeadingTabs(line: string, indentString: string): string {
		return line.replace(new RegExp(`^${indentString}+`), '');
	}

	public static addDaysToDate(date: Date, days: number): Date {
		const result = new Date(date.setDate(date.getDate() + days));
		return result;
	}

	public static addDaysToDateString(date: string, days: number): string {
		const result = NoteUtils.formatDate(new Date(new Date(date).setDate(new Date(date).getDate() + days)));
		return result;
	}

}