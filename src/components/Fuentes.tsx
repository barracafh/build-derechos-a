export type Source = { nombre: string; url: string };

const sinProtocolo = (url: string) =>
  url.replace(/^https?:\/\//, "").replace(/\/$/, "");

export function Fuentes({ fuentes }: { fuentes: readonly Source[] }) {
  return (
    <div className="text-lg">
      <h4 className="text-xl leading-[1.3] font-medium">Fuentes oficiales</h4>
      <ul className="mt-3 divide-y overflow-hidden rounded-xl ring-1 ring-foreground/10">
        {fuentes.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              className="flex min-h-11 items-center justify-between gap-4 px-4 py-3 transition-colors foco-interno hover:bg-muted focus-visible:bg-muted"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">
                <span className="block font-medium">{source.nombre}</span>
                {sinProtocolo(source.url) !== source.nombre && (
                  <span className="block font-mono text-base text-(--text-secondary)">
                    {sinProtocolo(source.url)}
                  </span>
                )}
              </span>
              <span aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
