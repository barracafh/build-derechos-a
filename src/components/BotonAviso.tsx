import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { site } from "@/config/sitio";

export function BotonAviso({ discreto = false }: { discreto?: boolean }) {
  return (
    <a
      href={site.feedbackUrl}
      className={cn(
        buttonVariants({ variant: discreto ? "outline" : "sunset", size: "lg" }),
        discreto
          ? "h-auto min-h-11 px-4 py-2 text-base"
          : "h-auto min-h-12 px-5 py-2 text-lg",
      )}
    >
      ¿Algo está mal? Avísanos
    </a>
  );
}
