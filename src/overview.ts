import { Entry } from './entry';
import { Note } from './note';
import { NoteUtils } from './note-utils';

export class Overview extends Note {
	public overviewEntries: Entry[] = [];
	private validDates: DateRange;
	private selectedDates: DateRange;
	private aggregatedEntries: EntriesByDay;
	private selectednoteID?: string;

	public constructor() {
		super('Overview'); // Creates a note with the hard-set title "overview"
		this.id = '.'+this.id; // force a . in front of title for file reasons

		const startOfToday = NoteUtils.startOfDay(new Date());
		this.selectedDates = new DateRange(startOfToday);
		this.validDates = new DateRange(startOfToday);
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
				const textLength = dataView.getUint16(i + 23);
				const entryLength = i + 25 + textLength;
				const newEntry = Entry.fromBinary(entryFile.slice(i, entryLength));
				newOverview.addEntry(newEntry)
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
			const day = NoteUtils.formatDate(entryWrapper.entry.created);
			if (!aggregatedEntries[day]) aggregatedEntries[day] = [];

			let isNewGroup = false;

			if (!previousEntryWrapper) {
				isNewGroup = true;
			} else {
				const previousEntry = previousEntryWrapper.entry;
				
				if (entryWrapper.sourcenoteID != previousEntryWrapper.sourcenoteID || currentEntry.groupId != previousEntry.groupId) {
					isNewGroup = true;
				}
			}

			const clonedEntry: Entry = Entry.fromPartial({...currentEntry});
			if (isNewGroup) nextDisplayGroupId++;
			clonedEntry.groupId = nextDisplayGroupId;

			aggregatedEntries[day].push(clonedEntry);
			previousEntryWrapper = entryWrapper;
		}
		return aggregatedEntries;
	}

	public createNewEntry(entryText: string, currentTime: Date, indentLevel: number, groupInterval: number, sourcenoteID?: string): Entry {
		// Determine groupID based on time and source note
		let groupID = 0;
		const entries = this.overviewEntries;
		if (entries.length > 0) {
			const prevEntry = entries[entries.length - 1];
			groupID = prevEntry.groupId;
			const timeSincePrev = currentTime.getTime() - prevEntry.created.getTime();
			// If time gap or source note changes, increment group
			if (
				timeSincePrev / 60000 > groupInterval ||
            (sourcenoteID && (prevEntry as Entry)['sourcenoteID'] !== sourcenoteID)
			) {
				groupID++;
			}
		}

		// Create new entry
		const newEntry = new Entry(entries.length, groupID, entryText, currentTime, indentLevel);

		// Add to overviewEntries
		this.overviewEntries.push(newEntry);
		this.isEntriesUnsaved = true;

		// Re-aggregate for display using EntryWithSource
		const allEntries: EntryWithSource[] = this.overviewEntries.map(e => ({
			entry: e,
			sourcenoteID: sourcenoteID || this.id,
		}));
		this.updateEntries(allEntries);

		return newEntry;
	}

	public addEntry(newEntry: Entry): void {
		this.overviewEntries.push(newEntry);
	}

	public isUnsaved(): boolean {
		return this.isEntriesUnsaved;
	}

	public clearEntries(): void {
		this.entries = [];
	}

	public updateEntries(allEntries: EntryWithSource[]): void { // Collects all entries and parses them
		this.overviewEntries.forEach(entry => {
			const newEntryWrapper: EntryWithSource = { entry: entry, sourcenoteID: this.id };
			allEntries.push(newEntryWrapper); // Adds its own entries to the collated entry thing
		});
		this.aggregatedEntries = Overview.collateEntries(allEntries);
		const earliestDate = Object.keys(this.aggregatedEntries).sort()[0] || this.validDates.getEarlierDate();
		this.validDates.setStart(earliestDate);
		this.updateEntriesShown();
	}

	private updateEntriesShown(): void { // Actually figures out what to display
		this.clearEntries();
		const startKey: string = this.selectedDates.getEarlierDate();
		const endKey: string = this.selectedDates.getLaterDate();
		for (const day in this.aggregatedEntries) {
			if (day >= startKey && day <= endKey) {
				this.entries.push(...this.aggregatedEntries[day]);
			}
		}
	}

	public updateSelectedDate(newDateStart: Date): boolean {
		const newDateRange: DateRange = new DateRange(newDateStart);
		if (newDateRange.start >= this.validDates.start && newDateRange.start <= this.validDates.end) {
			this.selectedDates = newDateRange;
			this.updateEntriesShown();
			return true;
		} else {
			return false;
		}
	}

	public updateSelectedDateRange(newDateRange: number): boolean {
		if (newDateRange == 0) return false;
		this.selectedDates.setRange(newDateRange);
		this.updateEntriesShown();
	}

	public stepForward(): string { // Returns a value true/false if the corresponding button should be greyed out
		this.selectedDates.increment(this.validDates.getLaterDate());
		this.updateEntriesShown();
		return this.selectedDates.start;
	}

	public stepBackward(): string {
		this.selectedDates.decrement(this.validDates.getEarlierDate());
		this.updateEntriesShown();
		return this.selectedDates.start;
	}

	public isCurrentDateRangeLatest(): boolean {
		return this.selectedDates.getLaterDate() >= this.validDates.end;
	}

	public isCurrentDateRangeEarliest(): boolean {
		return this.selectedDates.getEarlierDate() <= this.validDates.start;
	}

	public getOwnEntries(): Entry[] {
		return this.overviewEntries;
	}

	public getDates(): { earliest: string, latest: string } {
		return { earliest: this.validDates.start, latest: this.validDates.end };
	}

	public getCurrentDateRange(): { start: string, end?: string, range: number } {
		return this.selectedDates;
	}
}

class DateRange {
	public start: string;
	public end: string;
	public range: number = 1;

	public constructor(start: Date, range?: number) {
		this.start = NoteUtils.formatDate(start);
		if (range) this.range = range;
		this.updateEnd();
	}

	public static daysBetweenDates(start: Date, end: Date): number {
		return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
	}

	private updateEnd(): void {
		this.end = NoteUtils.addDaysToDateString(this.start, this.range - 1);
	}

	public increment(maxValue: string): void {
		this.start = NoteUtils.addDaysToDateString(this.start, Math.abs(this.range));
		this.start = this.start < maxValue ? this.start : maxValue; // Returns whichever date is earlier, capping it
		this.updateEnd();
	}

	public decrement(minValue: string): void {
		this.start = NoteUtils.addDaysToDateString(this.start, -1 * Math.abs(this.range));
		this.start = this.start > minValue ? this.start : minValue; // Returns whichever date is later
		this.updateEnd();
	}

	public setRange(newRange: number): void {
		if (newRange == 0) return;
		
		this.range = newRange;
		this.updateEnd();
	}

	public setStart(newStart: string): void {
		this.start = newStart;
		this.range = DateRange.daysBetweenDates(new Date(this.start), new Date(newStart));
		// We don't need to bother updating these to local time thankfully
	}

	public getEarlierDate(): string {
		return this.start < this.end ? this.start : this.end;
	}

	public getLaterDate(): string {
		return this.start > this.end ? this.start : this.end;
	}
}

interface EntriesByDay {
	[yyyyMMdd: string]: Entry[];
}

export interface EntryWithSource {
	entry: Entry;
	sourcenoteID: string;
}