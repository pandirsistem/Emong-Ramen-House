export const formatCurrency = (val: string | number): string => {
  const numericVal = typeof val === 'string' ? val.replace(/\D/g, '') : val;
  if (!numericVal) return '';
  return new Intl.NumberFormat('id-ID').format(Number(numericVal));
};

export const parseCurrency = (val: string): number => {
  return Number(val.replace(/\D/g, ''));
};
