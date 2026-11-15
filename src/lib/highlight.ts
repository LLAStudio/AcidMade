export interface Token {
  text: string;
  style: string;
}

const STYLES = {
  comment: "text-[#4d5866] italic",
  string: "text-[#a7e8b6]",
  keyword: "text-[#c9b6ff]",
  number: "text-[#f8d98a]",
  tag: "text-[#7dd3fc]",
  fn: "text-[#e6edf3]",
  punct: "text-[#64748b]",
  plain: "text-[#b7c2ce]",
  property: "text-[#8fb8ff]",
} as const;

const KEYWORDS =
  "import|export|from|default|const|let|var|function|return|if|else|for|while|of|in|type|interface|extends|implements|async|await|new|class|as|try|catch|finally|throw|switch|case|break|continue|typeof|instanceof|delete|false|true|null|undefined|void|number|string|boolean|unknown|never|Promise|Record|Array";

const PATTERN = new RegExp(
  [
    "(\\/\\/.*$)",
    "(\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`)",
    `\\b(${KEYWORDS})\\b`,
    "(\\b\\d+(?:\\.\\d+)?\\b)",
    "(<\\/?[A-Za-z][\\w.]*)",
    "(\\/?>)",
    "\\b([A-Za-z_$][\\w$]*)(?=\\s*\\()",
    "([A-Za-z_$][\\w$]*)(?=\\s*[:=](?!:))",
    "([{}()\\[\\];,.:=+\\-*/<>!?&|]+)",
  ].join("|"),
  "g",
);

export function tokenizeLine(line: string): Token[] {
  if (!line) return [{ text: " ", style: STYLES.plain }];

  const tokens: Token[] = [];
  let cursor = 0;
  PATTERN.lastIndex = 0;

  for (const match of line.matchAll(PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      tokens.push({ text: line.slice(cursor, start), style: STYLES.plain });
    }

    const [, comment, str, keyword, num, tag, closeTag, fn, property, punct] = match;
    const text = match[0];

    if (comment) tokens.push({ text, style: STYLES.comment });
    else if (str) tokens.push({ text, style: STYLES.string });
    else if (keyword) tokens.push({ text, style: STYLES.keyword });
    else if (num) tokens.push({ text, style: STYLES.number });
    else if (tag || closeTag) tokens.push({ text, style: STYLES.tag });
    else if (fn) tokens.push({ text, style: STYLES.fn });
    else if (property) tokens.push({ text, style: STYLES.property });
    else if (punct) tokens.push({ text, style: STYLES.punct });
    else tokens.push({ text, style: STYLES.plain });

    cursor = start + text.length;
  }

  if (cursor < line.length) {
    tokens.push({ text: line.slice(cursor), style: STYLES.plain });
  }

  return tokens;
}

export function tokenizeSource(source: string): Token[][] {
  return source.replace(/\n$/, "").split("\n").map(tokenizeLine);
}
