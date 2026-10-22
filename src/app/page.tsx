import { Chat } from "@/components/Chat";

// Buscador de ayudas con forma de chat: una pantalla inicial con la pregunta y,
// al enviar el primer mensaje, solo la conversación. La lógica vive en
// src/lib/llm y src/lib/ayudas, y la ruta de servidor en src/app/api/chat/route.ts.
export default function Home() {
  return <Chat />;
}
