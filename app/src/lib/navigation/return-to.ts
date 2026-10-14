const SAFE_RETURN_TO_PATTERN = /^[/](?![/\\])[^\\]*$/;

export function isSafeReturnTo(value: unknown): value is string {
  return typeof value === "string" && value.length <= 2048 && SAFE_RETURN_TO_PATTERN.test(value) && [...value].every((character) => {
    const code = character.charCodeAt(0);
    return code >= 0x20 && code !== 0x7f;
  });
}
