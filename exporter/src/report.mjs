// Collects everything the migration could not do cleanly, so nothing is lost silently.
export class Report {
	items = [];

	add(level, kind, ref, message) {
		this.items.push({ level, kind, ref, message });
	}

	counts() {
		const c = { info: 0, warn: 0, error: 0 };
		for (const i of this.items) c[i.level]++;
		return c;
	}

	toMarkdown(summary = {}) {
		const c = this.counts();
		const lines = ['# Migration report', ''];
		for (const [k, v] of Object.entries(summary)) lines.push(`- ${k}: ${v}`);
		lines.push(`- issues: ${c.error} errors, ${c.warn} warnings, ${c.info} notes`, '');
		if (this.items.length) {
			lines.push('| Level | Kind | Item | Details |', '|---|---|---|---|');
			const order = { error: 0, warn: 1, info: 2 };
			for (const i of [...this.items].sort((a, b) => order[a.level] - order[b.level] || a.ref.localeCompare(b.ref))) {
				lines.push(`| ${i.level} | ${i.kind} | ${i.ref} | ${i.message.replace(/\|/g, '\\|')} |`);
			}
		}
		return lines.join('\n') + '\n';
	}
}
