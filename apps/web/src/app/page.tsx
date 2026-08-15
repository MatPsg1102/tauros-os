import { redirect } from 'next/navigation';

// Operação Compartilhada V1: a experiência principal da loja é o quadro
// compartilhado. Os fluxos individuais (/turno) seguem disponíveis.
export default function Home(): never {
  redirect('/operacao');
}
