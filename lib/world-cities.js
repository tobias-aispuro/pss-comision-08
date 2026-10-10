const { cities } = require('world-cities-json')

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
}

function formatCity(city) {
  const parts = [city.city, city.admin_name, city.country].filter(Boolean)
  return [...new Set(parts)].join(', ')
}

function searchWorldCities(query) {
  const normalizedQuery = normalize(query)
  if (normalizedQuery.length < 2) return []

  return cities
    .filter((city) => {
      const name = normalize(city.city)
      const asciiName = normalize(city.city_ascii)
      return name.includes(normalizedQuery) || asciiName.includes(normalizedQuery)
    })
    .sort((first, second) => {
      const firstName = normalize(first.city)
      const secondName = normalize(second.city)
      const firstStarts = firstName.startsWith(normalizedQuery) ? 1 : 0
      const secondStarts = secondName.startsWith(normalizedQuery) ? 1 : 0
      if (firstStarts !== secondStarts) return secondStarts - firstStarts
      return Number(second.population || 0) - Number(first.population || 0)
    })
    .slice(0, 8)
    .map((city) => ({
      label: formatCity(city),
      city: city.city,
      region: city.admin_name || '',
      country: city.country,
    }))
}

function isWorldCityLabel(label) {
  const normalizedLabel = normalize(label)
  return cities.some((city) => normalize(formatCity(city)) === normalizedLabel)
}

module.exports = { isWorldCityLabel, searchWorldCities }