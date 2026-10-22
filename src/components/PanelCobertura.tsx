import { ChevronRight } from "lucide-react";
import type { Cobertura } from "@/lib/tipos";

// Qué fuentes se han mirado y cuáles no: así la persona sabe hasta dónde llega
// la respuesta (spec 001). Va plegado para no estorbar.
export function PanelCobertura({ c }: { c: Cobertura }) {
  return (
    <details className="group rounded-xl bg-muted px-5 py-2 text-lg">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 transition-transform group-open:rotate-90"
        />
        Hasta dónde he mirado
      </summary>
      <div className="grid gap-4 pt-1 pb-3 pl-7">
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
      </div>
    </details>
  );
}
