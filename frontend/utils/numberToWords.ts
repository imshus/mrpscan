const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function capitalizeWords(text: string): string {
  return text
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function twoDigitWords(num: number): string {
  if (num < 20) return ONES[num];
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  return `${TENS[tens]}${ones ? ` ${ONES[ones]}` : ''}`.trim();
}

function threeDigitWords(num: number): string {
  if (num === 0) return '';
  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;
  const hundredPart = hundreds ? `${ONES[hundreds]} Hundred` : '';
  const remainderPart = remainder ? twoDigitWords(remainder) : '';
  if (hundredPart && remainderPart) return `${hundredPart} ${remainderPart}`;
  return hundredPart || remainderPart;
}

function integerToWords(num: number): string {
  if (num === 0) return 'Zero';

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = num % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${twoDigitWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitWords(hundred));

  return parts.join(' ');
}

/** Converts a numeric amount into Indian English words, e.g. "One Lakh Eighty-Four Thousand Five Hundred Rupees Only". */
export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) {
    return 'Zero Rupees Only';
  }

  const rounded = Math.round(amount);
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  const rupeeWords = capitalizeWords(integerToWords(rupees));
  const rupeeLabel = rupees === 1 ? 'Rupee' : 'Rupees';

  if (paise > 0) {
    const paiseWords = capitalizeWords(integerToWords(paise));
    const paiseLabel = paise === 1 ? 'Paise' : 'Paise';
    return `${rupeeWords} ${rupeeLabel} and ${paiseWords} ${paiseLabel} Only`;
  }

  return `${rupeeWords} ${rupeeLabel} Only`;
}
