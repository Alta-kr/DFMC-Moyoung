// 셀 이름은 공백과 끝의 "셀"을 빼고 비교한다. "장미소", "장미소셀", "장미소 셀"이 모두 같은 셀이다.
// 공백만 뺀 이름이 정확히 같은 셀을 먼저 찾고, 없을 때만 "셀"을 뗀 이름으로 찾는다.
const compact = value => String(value ?? '').replace(/\s+/g, '');
const base = value => compact(value).replace(/셀$/, '');
export function findCell(docs, input) {
  const typed = compact(input);
  if (!typed) return undefined;
  return docs.find(doc => compact(doc.data().name) === typed)
    ?? (base(typed) ? docs.find(doc => base(doc.data().name) === base(typed)) : undefined);
}
