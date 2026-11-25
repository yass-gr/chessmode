/**
 * Gives a `.seg` control the iOS segmented-control thumb that slides to the pressed button.
 * Buttons keep owning `aria-pressed`; the thumb follows it, so callers change nothing else.
 */
export function seg(node: HTMLElement) {
	const thumb = document.createElement('span');
	thumb.className = 'seg-thumb';
	thumb.setAttribute('aria-hidden', 'true');
	node.prepend(thumb);
	node.classList.add('has-thumb');

	let placed = false;
	function place() {
		const on = node.querySelector<HTMLElement>('button[aria-pressed="true"]');
		thumb.style.opacity = on ? '1' : '0';
		if (!on) return;
		// The first placement must not slide in from the left edge.
		if (!placed) thumb.style.transition = 'none';
		thumb.style.width = `${on.offsetWidth}px`;
		thumb.style.transform = `translateX(${on.offsetLeft}px)`;
		if (!placed) {
			thumb.getBoundingClientRect();
			thumb.style.transition = '';
			placed = true;
		}
	}

	const pressed = new MutationObserver(place);
	pressed.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed'] });
	const resized = new ResizeObserver(() => {
		placed = false;
		place();
	});
	resized.observe(node);
	place();

	return {
		destroy() {
			pressed.disconnect();
			resized.disconnect();
			thumb.remove();
		}
	};
}
