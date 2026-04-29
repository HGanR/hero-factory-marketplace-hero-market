/** Split `<main>` inner HTML into section-sized chunks for Next / manifest metadata (same rules as export). */

export function splitMainHtmlIntoExportSections(inner: string): string[] {
  const chunks: string[] = [];
  const re = /<(?:section|footer)\b[^>]*>[\s\S]*?<\/(?:section|footer)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    chunks.push(m[0]!.trim());
  }
  return chunks.length > 0 ? chunks : [inner.trim()];
}
