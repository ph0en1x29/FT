const ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const ENTITY_RE = /[&<>"']/g;

export const sanitizeHtml = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).replace(ENTITY_RE, (char) => ENTITY_MAP[char] ?? char);
};
