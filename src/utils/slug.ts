export function toSnakeCase(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s_]/g, "")
		.replace(/\s+/g, "_")
		.replace(/^_+|_+$/g, "");
}
