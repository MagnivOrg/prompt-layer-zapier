// Helper function to normalize JSON string by escaping control characters in string literals
const normalizeJsonString = (jsonString) => {
  let result = "";
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];
    const prevChar = i > 0 ? jsonString[i - 1] : "";

    // Toggle string state when we hit an unescaped quote
    if (char === '"' && prevChar !== "\\") {
      inString = !inString;
      result += char;
      continue;
    }

    // If we're inside a string and hit a control character, escape it
    if (inString && !escapeNext) {
      if (char === "\n") {
        result += "\\n";
        continue;
      } else if (char === "\r") {
        result += "\\r";
        continue;
      } else if (char === "\t") {
        result += "\\t";
        continue;
      }
    }

    // Track escape sequences
    if (char === "\\" && inString) {
      escapeNext = !escapeNext;
    } else {
      escapeNext = false;
    }

    result += char;
  }

  return result;
};

module.exports = { normalizeJsonString };

