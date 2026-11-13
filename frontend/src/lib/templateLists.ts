import { useQuery } from '@tanstack/react-query';
import { referenceListsApi } from '../api/referenceListsApi';
import type { TemplateLists } from './projectTemplate';

/** The lists the import templates' drop-downs offer. */
export function useTemplateLists(): TemplateLists {
  const list = (category: 'COUNTRY' | 'WORKING_DOMAIN' | 'DESIGNATION') => ({
    queryKey: ['reference-lists', category],
    queryFn: () => referenceListsApi.list(category),
  });
  const countries = useQuery(list('COUNTRY'));
  const workingDomains = useQuery(list('WORKING_DOMAIN'));
  const designations = useQuery(list('DESIGNATION'));
  return {
    countries: (countries.data ?? []).map((e) => e.name),
    workingDomains: (workingDomains.data ?? []).map((e) => e.name),
    designations: (designations.data ?? []).map((e) => e.name),
  };
}
