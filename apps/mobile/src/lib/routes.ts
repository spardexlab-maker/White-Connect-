export function providerHref(facilityId: string, practitionerId: string | null | undefined) {
  return `/provider/${facilityId}${practitionerId ? `?practitioner=${practitionerId}` : ''}`;
}

export function bookHref(facilityId: string, practitionerId: string | null | undefined, serviceId?: string) {
  const q = [practitionerId && `practitioner=${practitionerId}`, serviceId && `service=${serviceId}`].filter(Boolean).join('&');
  return `/book/${facilityId}${q ? `?${q}` : ''}`;
}
