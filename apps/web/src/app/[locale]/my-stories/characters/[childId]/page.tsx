import { CharacterProfile } from '@/components/account/character-profile';

interface Props {
  params: Promise<{ locale: string; childId: string }>;
}

/** Perfil de un personaje: su dibujo, sus datos, el estado de su foto y los cuentos que tiene. */
export default async function CharacterProfilePage({ params }: Props) {
  const { childId } = await params;
  return <CharacterProfile childId={childId} />;
}
