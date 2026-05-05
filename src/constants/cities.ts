export interface City {
  city: string
  state: string
}

export const CITIES: City[] = [
  // DF — Regiões Administrativas
  { city: 'Brasília', state: 'DF' },
  { city: 'Gama', state: 'DF' },
  { city: 'Taguatinga', state: 'DF' },
  { city: 'Brazlândia', state: 'DF' },
  { city: 'Sobradinho', state: 'DF' },
  { city: 'Planaltina', state: 'DF' },
  { city: 'Paranoá', state: 'DF' },
  { city: 'Núcleo Bandeirante', state: 'DF' },
  { city: 'Ceilândia', state: 'DF' },
  { city: 'Guará', state: 'DF' },
  { city: 'Cruzeiro', state: 'DF' },
  { city: 'Samambaia', state: 'DF' },
  { city: 'Santa Maria', state: 'DF' },
  { city: 'São Sebastião', state: 'DF' },
  { city: 'Recanto das Emas', state: 'DF' },
  { city: 'Lago Sul', state: 'DF' },
  { city: 'Lago Norte', state: 'DF' },
  { city: 'Riacho Fundo', state: 'DF' },
  { city: 'Riacho Fundo II', state: 'DF' },
  { city: 'Candangolândia', state: 'DF' },
  { city: 'Águas Claras', state: 'DF' },
  { city: 'Sudoeste/Octogonal', state: 'DF' },
  { city: 'Varjão', state: 'DF' },
  { city: 'Park Way', state: 'DF' },
  { city: 'Estrutural', state: 'DF' },
  { city: 'Sobradinho II', state: 'DF' },
  { city: 'Jardim Botânico', state: 'DF' },
  { city: 'Itapoã', state: 'DF' },
  { city: 'Vicente Pires', state: 'DF' },
  { city: 'Fercal', state: 'DF' },
  // Entorno GO
  { city: 'Luziânia', state: 'GO' },
  { city: 'Formosa', state: 'GO' },
  { city: 'Planaltina de Goiás', state: 'GO' },
  { city: 'Cidade Ocidental', state: 'GO' },
  { city: 'Novo Gama', state: 'GO' },
  { city: 'Valparaíso de Goiás', state: 'GO' },
  { city: 'Santo Antônio do Descoberto', state: 'GO' },
  { city: 'Águas Lindas de Goiás', state: 'GO' },
  { city: 'Cristalina', state: 'GO' },
  { city: 'Alexânia', state: 'GO' },
  // Entorno MG
  { city: 'Unaí', state: 'MG' },
]

export function getCityLabel(c: City): string {
  return `${c.city} — ${c.state}`
}
