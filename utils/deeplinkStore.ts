let storedOobCode: string | null = null;

export function setOobCode(code: string | null) {
  storedOobCode = code;
}

export function getOobCode() {
  return storedOobCode;
}

export function clearOobCode() {
  storedOobCode = null;
}
