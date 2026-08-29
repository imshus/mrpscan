import type { ApiJewelleryType, JewelleryType } from '@/types/scanner';

const COMMON_FIELDS = ['grossWeight', 'netWeight', 'purity', 'labour', 'other'] as const;

const COLORSTONE_FIELDS = [
  'colorstoneWeight',
  'colorstoneRate',
  'colorstoneQuality',
  'colorstoneColor',
  'colorstoneClarity',
] as const;

const JEWELLERY_STONE_FIELDS: Record<JewelleryType, readonly string[]> = {
  Diamond: [
    'diamondWeight',
    'diamondRate',
    'diamondQuality',
    'diamondColor',
    'diamondClarity',
    'diamondPieces',
    ...COLORSTONE_FIELDS,
  ],
  Gold: [
    'goldWeight',
    'goldRate',
    'goldQuality',
    'goldPieces',
    ...COLORSTONE_FIELDS,
  ],
};

const SHARED_FIELD_LABELS: Record<string, string> = {
  grossWeight: 'Gross Wt',
  netWeight: 'Net Wt',
  purity: 'Purity / Tunch',
  pureWeight: 'Pure Wt',
  labour: 'Labour',
  other: 'Other',
};

const JEWELLERY_FIELD_LABELS: Record<JewelleryType, Record<string, string>> = {
  Diamond: {
    ...SHARED_FIELD_LABELS,
    diamondWeight: 'Diamond Wt',
    diamondRate: 'Diamond Rate',
    diamondQuality: 'Diamond Quality',
    diamondColor: 'Diamond Color',
    diamondClarity: 'Diamond Clarity',
    diamondPieces: 'Diamond Pieces',
    colorstoneWeight: 'CS Wt',
    colorstoneRate: 'CS Rate',
    colorstoneQuality: 'CS Quality',
    colorstoneColor: 'CS Color',
    colorstoneClarity: 'CS Clarity',
  },
  Gold: {
    ...SHARED_FIELD_LABELS,
    goldWeight: 'Gold Wt',
    goldRate: 'Gold Rate',
    goldQuality: 'Gold Quality',
    goldPieces: 'Gold Pieces',
    colorstoneWeight: 'CS Wt',
    colorstoneRate: 'CS Rate',
    colorstoneQuality: 'CS Quality',
    colorstoneColor: 'CS Color',
    colorstoneClarity: 'CS Clarity',
  },
};

export function getAvailableFieldsForJewelleryType(jewelleryType: JewelleryType): string[] {
  return [...COMMON_FIELDS, ...JEWELLERY_STONE_FIELDS[jewelleryType]];
}

export function getClarificationFieldLabel(
  field: string,
  jewelleryType: JewelleryType,
): string {
  return JEWELLERY_FIELD_LABELS[jewelleryType][field] ?? field;
}

export function getAvailableFieldsForApiJewelleryType(
  jewelleryType: ApiJewelleryType | string,
): string[] {
  const normalized = jewelleryType.toUpperCase() as ApiJewelleryType;
  const typeMap: Record<ApiJewelleryType, JewelleryType> = {
    DIAMOND: 'Diamond',
    GOLD: 'Gold',
  };

  return getAvailableFieldsForJewelleryType(typeMap[normalized] ?? 'Diamond');
}

export function applyJewelleryTypeToClarificationFields<
  T extends { availableFields: string[]; suggestedField: string },
>(fields: T[], jewelleryType: JewelleryType): T[] {
  const availableFields = getAvailableFieldsForJewelleryType(jewelleryType);

  return fields.map((field) => ({
    ...field,
    availableFields,
    suggestedField: availableFields.includes(field.suggestedField)
      ? field.suggestedField
      : 'other',
  }));
}

export function getJewelleryTypeFromApi(apiType?: string | null): JewelleryType {
  const map: Record<string, JewelleryType> = {
    DIAMOND: 'Diamond',
    GOLD: 'Gold',
  };
  return map[(apiType ?? '').toUpperCase()] ?? 'Diamond';
}

export function jewelleryTypeToApi(type: JewelleryType): ApiJewelleryType {
  const map: Record<JewelleryType, ApiJewelleryType> = {
    Diamond: 'DIAMOND',
    Gold: 'GOLD',
  };
  return map[type] ?? 'DIAMOND';
}
