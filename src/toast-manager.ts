export class ToastManager {
	private container: HTMLDivElement;
	private readonly TOAST_TYPES: string[] = ['error', 'info', 'warn'];
	private toastDuration: number;

	public constructor(toastDuration: number) {
		this.toastDuration = toastDuration;
		const container = document.createElement('div');
		container.className = 'toast-container';
		document.body.appendChild(container);
		this.container = container;
	}

	public show(type: string, message: string): void {
		const toast_type: string = this.TOAST_TYPES.includes(type) ? type : this.TOAST_TYPES[1];
		const toast = document.createElement('div');
		toast.classList.add('toast',toast_type);
		toast.textContent = message;
		this.container.appendChild(toast);

		requestAnimationFrame(() => toast.classList.add('show'));

		setTimeout(() => {
			toast.classList.remove('show');
			toast.addEventListener('transitionend', () => toast.remove());
		}, this.toastDuration);
	}
}
