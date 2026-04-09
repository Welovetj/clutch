export function currency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function signed(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

export function americanOdds(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
