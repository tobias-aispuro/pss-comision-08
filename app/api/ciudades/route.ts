import { searchWorldCities } from '@/lib/world-cities'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') ?? ''
  return Response.json(searchWorldCities(query))
}