export function claveFecha(valor: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0, 10);
  return new Date(valor).toISOString().slice(0, 10);
}

export function mostrarFecha(valor?: string | null): string {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("es-SV", { dateStyle: "medium", timeZone: "UTC" })
    .format(new Date(`${claveFecha(valor)}T12:00:00.000Z`));
}
