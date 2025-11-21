import { Entry } from './entry';
import { Note } from './note';
import { NoteUtils } from './note-utils';

export class Overview extends Note {
	public overviewEntries: Entry[] = [];
	public earliestDate: string;
	public currentDate: string;
	private selectedDateRange: DateRange;
	private aggregatedEntries: EntriesByDay;
	private selectedNoteId?: string;

	public constructor() {
		super('Overview'); // Creates a note with the hard-set title "overview"
		this.id = '.'+this.id; // force a . in front of title for file reasons
		this.currentDate = DateRange.convertFromDate(new Date());
		this.selectedDateRange = new DateRange(new Date())
		this.isPersistentTextUnsaved = false;
		this.isTitleSet = true;
	}

	public static async loadFromFile(): Promise<Overview> {
		const entriesFileName: string = '.overview-entries';
		
		const newOverview = new Overview();
		
		if (NoteUtils.doesFileExist(entriesFileName+'.bin')) {
			const entryFile = await NoteUtils.getBinaryFile(entriesFileName);
			const dataView = new DataView(entryFile);
			let i = 0;

			while (i < entryFile.byteLength) {
				const id = dataView.getUint16(i + 0);
				const groupId = dataView.getUint16(i + 2);
				const quotedId = dataView.getUint16(i + 4);
				const indentLevel = dataView.getUint8(i + 6);
				const created = new Date(Number(dataView.getBigUint64(i + 7)));
				const lastEdited = new Date(Number(dataView.getBigUint64(i + 15)));
				const textLength = dataView.getUint16(i + 23);
				const text = new TextDecoder('utf-8').decode(entryFile.slice(i + 25, i + 25 + textLength)); // ? Should this be split across multiple lines

				newOverview.addEntry(new Entry(id, groupId, text, created, indentLevel, lastEdited, quotedId));
				i += 25 + textLength;
			}

			return newOverview;
		} else {
			console.error(`Could not find entries file ${entriesFileName}!`);
		}
	
	}

	private static collateEntries(allEntries: EntryWithSource[]): EntriesByDay {
		const sortedEntries: EntryWithSource[] = [...allEntries].sort((a, b) =>
			a.entry.created.getTime() - b.entry.created.getTime(),
		);
		const aggregatedEntries: EntriesByDay = {};
		let nextDisplayGroupId = -1;
		let previousEntryWrapper: EntryWithSource | null = null;

		for (const entryWrapper of sortedEntries) {
			const currentEntry = entryWrapper.entry;
			const day = DateRange.convertFromDate(entryWrapper.entry.created);
			if (!aggregatedEntries[day]) aggregatedEntries[day] = [];

			let isNewGroup = false;

			if (!previousEntryWrapper) {
				isNewGroup = true;
			} else {
				const previousEntry = previousEntryWrapper.entry;
				
				if (entryWrapper.sourceNoteId != previousEntryWrapper.sourceNoteId || currentEntry.groupId != previousEntry.groupId) {
					isNewGroup = true;
				}
			}

			const clonedEntry: Entry = Entry.fromPartial({...currentEntry});
			if (isNewGroup) nextDisplayGroupId++;
			clonedEntry.groupId = nextDisplayGroupId;

			aggregatedEntries[day].push(clonedEntry);
			previousEntryWrapper = entryWrapper;
		}
		return aggregatedEntries
	}

	public addEntry(newEntry: Entry): void {
		this.overviewEntries.push(newEntry);
		this.updateEntriesShown();
		this.isEntriesUnsaved = true;
	}

	public clearEntries(): void {
		this.entries = [];
	}

	public updateEntries(allEntries: EntryWithSource[]): void { // Collects all entries and parses them
		this.overviewEntries.forEach(entry => {
			const newEntryWrapper: EntryWithSource = { entry: entry, sourceNoteId: this.id };
			allEntries.push(newEntryWrapper); // Adds its own entries to the collated entry thing
		});
		this.aggregatedEntries = Overview.collateEntries(allEntries);
		this.earliestDate = Object.keys(this.aggregatedEntries).sort()[0] || this.currentDate;
		this.updateEntriesShown();
	}

	private updateEntriesShown(): void { // Actually figures out what to display
		this.clearEntries();
		const startKey: string = this.selectedDateRange.start;
		const endKey:string = this.selectedDateRange.end ?? startKey;

		for (const day in this.aggregatedEntries) {
			if (day >= startKey && day <= endKey) {
				this.entries.push(...this.aggregatedEntries[day]);
			}
		}
	}

	public updateSelectedDate(newDateStart: Date): boolean {
		const newDateRange: DateRange = new DateRange(newDateStart);
		if (newDateRange.start >= this.earliestDate && newDateRange.start <= this.currentDate) {
			this.selectedDateRange = newDateRange;
			return true;
		} else {
			return false;
		}
	}

	public updateSelectedDateRange(newDateRange: number): boolean {
		if (newDateRange == 0) return false;
		this.selectedDateRange.end = DateRange.convertFromDate(DateRange.addDaysToDates(this.selectedDateRange.start, newDateRange));
	}

	public stepForward(): void { // Returns a value true/false if the corresponding button should be greyed out
		this.selectedDateRange.stepDateRange(this.selectedDateRange.range);
	}

	public stepBackward(): void {
		this.selectedDateRange.stepDateRange(-this.selectedDateRange.range);
	}

	public isCurrentDateLatest(): boolean {
		return (this.selectedDateRange.end || this.selectedDateRange.start) >= this.currentDate;
	}

	public isCurrentDateEarliest(): boolean {
		return this.selectedDateRange.start <= this.earliestDate;
	}

	public getOwnEntries(): Entry[] {
		return this.overviewEntries;
	}
}

class DateRange {
	public start: string;
	public end?: string;
	public range: number = 1;

	public constructor(start: Date, end?: Date) {
		this.start = DateRange.convertFromDate(start)
		if (end) {
			this.end = DateRange.convertFromDate(end);
			this.range = DateRange.daysBetweenDates(start, end);
		}
	}

	public static addDaysToDates(date: string, days: number): Date {
		const result = new Date(
			parseInt(date.slice(0, 4)),
			parseInt(date.slice(4, 6)) - 1,
			parseInt(date.slice(6, 8)),
		);
		result.setDate(result.getDate() + days);

		return result;
	}

	public static daysBetweenDates(start: Date, end: Date): number {
    	return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
	}

	public static convertFromDate(date: Date): string {
		return (date.toISOString().slice(0, 10).replace(/-/g, ''));
	}

	public stepDateRange(days: number): void {
		this.start = DateRange.convertFromDate(DateRange.addDaysToDates(this.start, days));
		if (this.end) this.end = DateRange.convertFromDate(DateRange.addDaysToDates(this.end, days));
	}
}

interface EntriesByDay {
	[yyyyMMdd: string]: Entry[];
}

export interface EntryWithSource {
	entry: Entry;
	sourceNoteId: string;
}