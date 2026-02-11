export function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, "");

  // If stored as 9 digits without leading 0, prepend it
  if (digits.length === 9 && digits.startsWith("7")) {
    digits = "0" + digits;
  }

  digits = digits.slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export function cleanPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  // Handle +94 / 94 country code → convert to local 0 prefix
  if (digits.startsWith("94") && digits.length > 2) {
    digits = "0" + digits.slice(2);
  }
  // Only allow starting with 0
  if (digits.length > 0 && digits[0] !== "0") return "";
  return digits.slice(0, 10);
}

export function unformatPhone(value: string): string {
  return value.replace(/\D/g, "");
}
