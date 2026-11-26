/** The depth chooser and a milestone sheet must not stack. */
let locks = 0;
const listeners = new Set<() => void>();

const emit = () => {
	for (const listener of listeners) listener();
};

export function lockSheets(): () => void {
	locks += 1;
	emit();
	return () => {
		locks = Math.max(0, locks - 1);
		emit();
	};
}

export const sheetsLocked = () => locks > 0;

export function onSheetLock(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
