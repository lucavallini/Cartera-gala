export type Donde = Record<string, unknown>;

/**
 * La parte de un delegate de Prisma (bd.cartera, bd.cuenta, …) que usan los repositorios base.
 * Los delegates reales la cumplen estructuralmente; el compilador verifica los tipos de datos.
 */
export interface DelegadoPrisma<TModelo, TCrear, TEditar> {
  findFirst(args: { where: Donde }): PromiseLike<TModelo | null>;
  findMany(args: {
    where: Donde;
    orderBy: Record<string, "asc" | "desc">[];
    skip: number;
    take: number;
  }): PromiseLike<TModelo[]>;
  count(args: { where: Donde }): PromiseLike<number>;
  create(args: { data: TCrear }): PromiseLike<TModelo>;
  update(args: {
    where: { id: string };
    data: TEditar | { eliminadoEn: Date };
  }): PromiseLike<TModelo>;
}
