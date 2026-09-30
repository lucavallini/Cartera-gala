/** Forma única en que se guardan y comparan los emails. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}
