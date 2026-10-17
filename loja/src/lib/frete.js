// ================================================================
// frete.js — Cálculo de frete por distância (Haversine)
// ================================================================
// EDITÁVEL: ajuste os valores abaixo sem mexer no restante do código.
// ate_km: distância máxima para esta faixa (null = fora da área).
// preco:  taxa de entrega em reais (null = não entregamos).
// label:  texto exibido ao cliente.
// ================================================================
export const ZONAS_FRETE = [
  { ate_km: 3,    preco: 5,    label: 'Praia Brava / Santa Clara' },
  { ate_km: 7,    preco: 10,   label: 'Itajaí Centro' },
  { ate_km: 12,   preco: 15,   label: 'Itajaí — bairros afastados' },
  { ate_km: null, preco: null, label: 'Fora da área de entrega' },
]
// ================================================================

// Coordenadas do Porto Grill — Praia Brava, Itajaí SC
const PORTO_LAT = -26.9500538
const PORTO_LNG = -48.6298396

/**
 * Fórmula de Haversine.
 * Retorna a distância em km entre dois pontos geográficos.
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = deg => deg * (Math.PI / 180)
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Dado distanciaKm, retorna a faixa de frete correspondente.
 * Retorna { entrega: bool, preco: number, label: string }
 */
export function calcularFrete(distanciaKm) {
  for (const zona of ZONAS_FRETE) {
    if (zona.ate_km === null) {
      return { entrega: false, preco: 0, label: zona.label }
    }
    if (distanciaKm <= zona.ate_km) {
      return { entrega: true, preco: zona.preco, label: zona.label }
    }
  }
  return { entrega: false, preco: 0, label: ZONAS_FRETE.at(-1).label }
}

/**
 * Consulta ViaCEP e retorna logradouro, bairro, cidade, uf.
 * Lança Error em caso de CEP inválido ou não encontrado.
 */
export async function buscarCep(cep) {
  const limpo = cep.replace(/\D/g, '')
  if (limpo.length !== 8) throw new Error('CEP inválido — deve ter 8 dígitos')
  const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
  if (!res.ok) throw new Error('Falha ao consultar ViaCEP')
  const data = await res.json()
  if (data.erro) throw new Error('CEP não encontrado')
  return {
    logradouro: data.logradouro || '',
    bairro:     data.bairro     || '',
    cidade:     data.localidade || '',
    uf:         data.uf         || '',
  }
}

/**
 * Geocodifica o endereço via Nominatim (OpenStreetMap) — sem API key.
 * Retorna { lat, lng } ou null se não encontrado.
 *
 * Respeita o limite de 1 req/s do Nominatim:
 * para uso em produção de alto volume, substitua por Google Maps Geocoding API.
 */
export async function geocodificar(logradouro, numero, bairro, cidade, uf) {
  const q = `${logradouro}, ${numero}, ${bairro}, ${cidade}, ${uf}, Brasil`
  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PortoGrillDelivery/1.0 (contato@portogrill.com.br)' },
  })
  if (!res.ok) throw new Error('Falha ao geocodificar endereço')
  const data = await res.json()
  if (!data.length) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

/**
 * Pipeline completo: endereço → coordenadas → distância → frete.
 * Retorna objeto com todas as informações necessárias para salvar no pedido.
 *
 * Em caso de sucesso:
 *   { ok: true, entrega, preco, label, distancia_km, lat, lng }
 * Em caso de falha:
 *   { ok: false, erro: string }
 */
export async function calcularFreteEndereco(logradouro, numero, bairro, cidade, uf) {
  try {
    const coords = await geocodificar(logradouro, numero, bairro, cidade, uf)
    if (!coords) {
      return { ok: false, erro: 'Endereço não encontrado. Verifique os dados e tente novamente.' }
    }
    const distancia_km = haversineKm(PORTO_LAT, PORTO_LNG, coords.lat, coords.lng)
    const frete = calcularFrete(distancia_km)
    return {
      ok: true,
      ...frete,
      distancia_km,
      lat: coords.lat,
      lng: coords.lng,
    }
  } catch (err) {
    return { ok: false, erro: err.message || 'Erro ao calcular frete' }
  }
}
