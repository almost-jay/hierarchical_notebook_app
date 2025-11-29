export class ToastManager {
	private readonly TOAST_TYPES: string[] = ['error', 'info', 'warn'];
	private readonly DEBUG_COLOURS: Readonly<{
		error: string;
		info: string;
		warn: string;
		}> = {
			error: '#FF0000',
			info:  '#526b7c',
			warn:  '#FFA500',
		};

	private container: HTMLDivElement;
	private toastDuration: number;
	private debug: boolean;

	public constructor(toastDuration: number) {
		this.toastDuration = toastDuration;
		const container = document.createElement('div');
		container.className = 'toast-container';
		document.body.appendChild(container);
		this.container = container;

		this.debug = true; // DEBUG
	}

	public show(type: string, message: string): void {
		const toast_type: string = this.TOAST_TYPES.includes(type) ? type : this.TOAST_TYPES[1];
		const toast = document.createElement('div');
		toast.classList.add('toast',toast_type);
		toast.textContent = message;
		this.container.appendChild(toast);

		if (this.debug) {
			console.log('%cToast message: '+message,'color: '+this.DEBUG_COLOURS[type]);
		}

		requestAnimationFrame(() => toast.classList.add('show'));

		setTimeout(() => {
			toast.classList.remove('show');
			toast.addEventListener('transitionend', () => toast.remove());
		}, this.toastDuration);
	}
}
