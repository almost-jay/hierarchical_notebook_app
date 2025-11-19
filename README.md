This is a WIP notebook app intended to help organise many many thoughts. I currently keep all my notes in a single, giant text file, but that kinda sucks. 
Making new files for every new idea is just too much work.
I sometimes use Discord for larger projects, but this is laggy and means you have to read through old messages or keep updating a pinned message.

So this app has (planned features):
- [] Notes on the left, with a handy "Add Note" button so that you can jump between them quickly
- [] A "permanent/traditional" notepad in one panel ("big" note)
	- [] A todo list in the "big" note
- [] A format similar to Discord in another panel, with entries editable and automatically dated
	- [] Entries include hierarchical notes that can be collapsed and expanded
	- [] Entries can be quoted or replied to
	- [] Entries can be pinned
	- [] Entries can be moved from note to note
- [] Image/media attachment
- [] Markdown formatting
	- [] Live preview - formatting syntax is greyed out and the affected text is displayed as formatted
	- [] Tables
- [] A Find box for the notepad panel with regex
- [] A Search box with regex and date for the feed panel
- [] A "daily" note where all entries made for each day are collated into one block, sorted purely by time
	- [] The "big" note associated with each entry can be viewed by selecting an entry

Too lazy to learn how to use QT/GDK frameworks, so Tauri + TypeScript until I can be bothered moving

* Run with `npm run tauri dev`
* If it complains, try `cargo clean --manifest-path src-tauri/Cargo.toml` first