import { z } from "zod";

export const esquemaConsultaResumen = z.object({
  carteraId: z.string().min(1).optional(),
  moneda: z.enum(["ARS", "USD"], { message: "Elegí la moneda: ARS o USD." }).optional(),
});

export type ConsultaResumen = z.output<typeof esquemaConsultaResumen>;
