import { Entry, ENTRY_BINARY_FORMAT } from './entry';
import { Note } from './note';
import { NoteUtils } from './note-utils';

export class Overview extends Note {
	public overviewEntries: Entry[] = []; // The list of its OWN entries, rather than any entries from other notes
	private allCollatedEntries: EntryWithSource[] = []; // Should always have the same contents as this.entries
	private validDates: DateRange;
	private selectedDates: DateRange;
	private aggregatedEntries: EntriesByDay; // contains an array of entries with source note IDs for each day
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
				const textLength = dataView.getUint16(i + ENTRY_BINARY_FORMAT.TEXT_LENGTH_OFFSET);
				const entryLength = i + ENTRY_BINARY_FORMAT.HEADER_SIZE + textLength;
				const newEntry = Entry.fromBinary(entryFile.slice(i, entryLength));
				newOverview.addEntry(newEntry)
				i += ENTRY_BINARY_FORMAT.HEADER_SIZE + textLength;
			}
			return newOverview;
		} else {
			console.error(`Could not find entries file ${entriesFileName}!`);
		}
	
	}

	private static sortEntries(allEntries: EntryWithSource[]): EntriesByDay {
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

			clonedEntry.id = aggregatedEntries[day].length; 

			entryWrapper.entry = clonedEntry;
			entryWrapper.displayGroupId = nextDisplayGroupId;
			
			aggregatedEntries[day].push(entryWrapper);
			previousEntryWrapper = entryWrapper;
		}
		return aggregatedEntries;
	}

	public createNewEntry(entryText: string, currentTime: Date, indentLevel: number, groupInterval: number, sourcenoteID?: string): Entry {
		// Determine groupID based on time and source note
		let groupID = 0;
		if (this.overviewEntries.length > 0) {
			const prevEntry = this.overviewEntries[this.overviewEntries.length - 1];
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
		const newEntry = new Entry(this.overviewEntries.length, groupID, entryText, currentTime, indentLevel);

		// Add to overviewEntries
		this.overviewEntries.push(newEntry);
		this.isEntriesUnsaved = true;

		// Re-aggregate for display using EntryWithSource
		const allEntries: EntryWithSource[] = this.overviewEntries.map((e, i) => ({
			entry: e,
			sourcenoteID: sourcenoteID || this.id,
			localID: i,
			originalID: e.id,
			displayGroupId: e.groupId,
		}));
		this.updateEntries(allEntries);

		return newEntry;
	}

	public getEntryWithSource(entryID: number): EntryWithSource {
		const targetEntry = this.entries[entryID];
		const entryWithSource = this.allCollatedEntries.find(entryData => entryData.entry == targetEntry);
		return entryWithSource;
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

	public updateEntries(allEntries: EntryWithSource[]): void { // Collects all the entries and parses them
		this.allCollatedEntries = allEntries;
		this.overviewEntries.forEach(entry => {
			const newEntryWrapper: EntryWithSource = { entry: entry, sourcenoteID: this.id, localID: this.allCollatedEntries.length, originalID: entry.id, displayGroupId: entry.groupId };
			this.allCollatedEntries.push(newEntryWrapper); // Adds its own entries to the collated entry thing
		});
		this.aggregatedEntries = Overview.sortEntries(this.allCollatedEntries);
		
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
				this.entries.push(...this.aggregatedEntries[day].map(ews =>
					(ews.entry.groupId = ews.displayGroupId, ews.entry),
				));
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

	public getDisplayedEntries(): Entry[] {
		// may need to do a refresh here?
		return this.entries;
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
	[yyyyMMdd: string]: EntryWithSource[];
}

export interface EntryWithSource {
	entry: Entry;
	sourcenoteID: string;
	localID: number; // position in the array the EWS is stored in
	originalID: number; // the ID of the entry when it was in the source note
	displayGroupId: number;
}