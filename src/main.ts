function initialiseInput() {
	const logInput = document.getElementById("log-input") as HTMLTextAreaElement;
	console.log("log input");
	console.log(logInput);

	logInput.addEventListener("beforeinput", (e) => {
		// Add insertLineBreak as eventType here?
	});
	logInput.addEventListener("keydown", (e) => {
		console.log(e.key);
		if (e.key == 'Tab') {
			e.preventDefault();

			const start: number = logInput.selectionStart;
			const end: number = logInput.selectionEnd;

			const text: string = logInput.value;

			if (e.shiftKey) { // Shift + Tab should be outdent/dedent
				const newText: string = shiftSelectedText(text, start, end, -1);
				logInput.value = newText;
				
			} else {
				const newText: string = shiftSelectedText(text, start, end, 1);
				logInput.value = newText;
			}

		// } else if (e.key == 'Enter') {
		// 	if (e.shiftKey) {
		// 		e.preventDefault();
		// 		console.log("enter + shift")
		// 		// Shift + Enter to send message.
		// 	}
		}
	});
}

function shiftSelectedText(text: String, start: number, end: number, offset: number): string {
	const lines = text.split('\n');
	
	if (text.slice(start, end) == '' && offset == 1) return '\t'+text; // Quick indentation even when there is no text at all
	
	let charCount = 0;
	for (let i = 0; i < lines.length; i++) {
		const lineLength = lines[i].length + 1; // +1 because of \n (\n = 1 char)
		if (charCount + lineLength > start && charCount < end) { // In/outdent even if the line is only partially selected
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

initialiseInput();