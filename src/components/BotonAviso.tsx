import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { site } from "@/config/sitio";

export function BotonAviso() {
  return (
    <a
      href={site.feedbackUrl}
      className={cn(
        buttonVariants({ variant: "sunset", size: "lg" }),
        "h-auto min-h-12 px-5 py-2 text-lg",
      )}
    >
      ¿Algo está mal? Avísanos
    </a>
  );
}
