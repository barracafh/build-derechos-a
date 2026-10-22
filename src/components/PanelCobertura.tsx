import { Card } from "@/components/ui/card";
import type { Cobertura } from "@/lib/tipos";

// Qué fuentes se han mirado y cuáles no: así la persona sabe hasta dónde llega
// la respuesta (spec 001).
export function PanelCobertura({ c }: { c: Cobertura }) {
  return (
    <Card
      render={<section />}
      className="gap-4 bg-muted px-6 py-6 text-lg ring-0"
    >
      <h3 className="text-xl leading-[1.3] font-medium">Hasta dónde he mirado</h3>
      {c.consultado.length > 0 && (
        <div className="grid gap-2">
          <h4 className="text-lg font-medium text-(--text-secondary)">
            He mirado
          </h4>
          <ul className="grid list-disc gap-2 pl-7">
            {c.consultado.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {c.noConsultado.length > 0 && (
        <div className="grid gap-2">
          <h4 className="text-lg font-medium text-(--text-secondary)">
            No he mirado
          </h4>
          <ul className="grid list-disc gap-2 pl-7 [overflow-wrap:anywhere]">
            {c.noConsultado.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {c.respaldo && (
        <p>
          Estos datos son una copia con fecha, no la fuente en directo. Pueden
          haber cambiado.
        </p>
      )}
    </Card>
  );
}
