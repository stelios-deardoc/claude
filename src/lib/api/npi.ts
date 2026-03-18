// NPPES NPI Registry REST API client
// Docs: https://npiregistry.cms.hhs.gov/api-page

const NPI_API = 'https://npiregistry.cms.hhs.gov/api/';

export interface NPIResult {
  npi: string;
  name: string;
  firstName: string;
  lastName: string;
  credential: string;
  specialty: string;
  address: string;
  phone: string;
  enumeration_type: string;
}

interface NPIResponse {
  result_count: number;
  results: {
    number: string;
    enumeration_type: string;
    basic: {
      first_name?: string;
      last_name?: string;
      credential?: string;
      organization_name?: string;
      name?: string;
    };
    taxonomies: {
      code: string;
      desc: string;
      primary: boolean;
      state: string;
      license: string;
    }[];
    addresses: {
      address_purpose: string;
      address_1: string;
      city: string;
      state: string;
      postal_code: string;
      telephone_number: string;
    }[];
  }[];
}

function parseResult(r: NPIResponse['results'][0]): NPIResult {
  const primary = r.taxonomies?.find(t => t.primary) || r.taxonomies?.[0];
  const practice = r.addresses?.find(a => a.address_purpose === 'LOCATION') || r.addresses?.[0];

  const isOrg = r.enumeration_type === 'NPI-2';
  const name = isOrg
    ? (r.basic.organization_name || r.basic.name || '')
    : `${r.basic.first_name || ''} ${r.basic.last_name || ''}`.trim();

  return {
    npi: r.number,
    name,
    firstName: r.basic.first_name || '',
    lastName: r.basic.last_name || '',
    credential: r.basic.credential || '',
    specialty: primary?.desc || '',
    address: practice
      ? `${practice.address_1}, ${practice.city}, ${practice.state} ${practice.postal_code}`
      : '',
    phone: practice?.telephone_number || '',
    enumeration_type: r.enumeration_type,
  };
}

export async function searchNPI(
  firstName: string,
  lastName: string,
  state?: string,
): Promise<NPIResult[]> {
  const params = new URLSearchParams({
    version: '2.1',
    first_name: firstName,
    last_name: lastName,
    limit: '5',
  });
  if (state) params.set('state', state);

  const res = await fetch(`${NPI_API}?${params}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NPI API error (${res.status}): ${text}`);
  }

  const data: NPIResponse = await res.json();
  if (!data.results?.length) return [];
  return data.results.map(parseResult);
}

export async function lookupNPI(npi: string): Promise<NPIResult | null> {
  const params = new URLSearchParams({
    version: '2.1',
    number: npi,
  });

  const res = await fetch(`${NPI_API}?${params}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NPI API error (${res.status}): ${text}`);
  }

  const data: NPIResponse = await res.json();
  if (!data.results?.length) return null;
  return parseResult(data.results[0]);
}

// Search by organization name
export async function searchNPIOrganization(name: string, state?: string): Promise<NPIResult[]> {
  const params = new URLSearchParams({
    version: '2.1',
    organization_name: name,
    enumeration_type: 'NPI-2',
    limit: '5',
  });
  if (state) params.set('state', state);

  const res = await fetch(`${NPI_API}?${params}`);
  if (!res.ok) return [];

  const data: NPIResponse = await res.json();
  if (!data.results?.length) return [];
  return data.results.map(parseResult);
}
