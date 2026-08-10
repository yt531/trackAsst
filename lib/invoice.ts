import { InvoiceItem } from '@/types';

// Parsing invoice QR Code data based on MoF spec v1.9
export const parseInvoiceQRCode = (rawData: string) => {
  const data = rawData.trim();
  if (!data || data.length < 77 || !/^[A-Z]{2}[0-9]{8}/.test(data)) {
    throw new Error('Invalid Invoice QR Code format');
  }

  const number = data.substring(0, 10);
  const dateStr = data.substring(10, 17); // ROC Date: 1120512
  const randomNumber = data.substring(17, 21);
  const salesHex = data.substring(21, 29);
  const totalHex = data.substring(29, 37);
  const buyerId = data.substring(37, 45);
  const sellerId = data.substring(45, 53);
  const encrypt = data.substring(53, 77);

  const totalAmount = parseInt(totalHex, 16);

  // Try to parse items if available. Items follow the 77 chars and are separated by colons.
  // Format after 77 chars: :**********:1:1:1:ItemName:1:100:
  let items: InvoiceItem[] = [];
  const remaining = data.substring(77);
  const parts = remaining.split(':');

  // parts[0] is typically the business custom area (or empty)
  // parts[1] is typically **********
  // parts[2] items count in left QR
  // parts[3] total items count
  // parts[4] encoding (0=Big5, 1=UTF-8, 2=Base64)
  // Then [Name, Qty, Price] repeats

  if (parts.length > 5) {
      let currentIndex = 5;
      while (currentIndex + 2 < parts.length && parts[currentIndex]) {
          const name = parts[currentIndex];
          const qty = parseInt(parts[currentIndex + 1], 10) || 1;
          const price = parseInt(parts[currentIndex + 2], 10) || 0;
          items.push({
              description: name,
              quantity: qty,
              unitPrice: price,
              amount: qty * price
          });
          currentIndex += 3;
      }
  }

  return {
    number,
    date: rocDateToUnixTimestamp(dateStr),
    dateStr,
    randomNumber,
    totalAmount,
    buyerId,
    sellerId,
    encrypt,
    items,
    totalItemsExpected: parseInt(parts[3], 10) || items.length // Extract total expected items
  };
};

export const parseRightQRCode = (rawData: string) => {
  const data = rawData.trim();
  if (!data.startsWith('**')) {
    throw new Error('Invalid Right QR Code');
  }
  
  // Format: **itemName:qty:price:itemName:qty:price...
  const parts = data.substring(2).split(':');
  let items: InvoiceItem[] = [];
  let currentIndex = 0;
  
  while (currentIndex + 2 < parts.length && parts[currentIndex]) {
      const name = parts[currentIndex];
      const qty = parseInt(parts[currentIndex + 1], 10) || 0;
      const price = parseInt(parts[currentIndex + 2], 10) || 0;
      items.push({
          description: name,
          quantity: qty,
          unitPrice: price,
          amount: qty * price
      });
      currentIndex += 3;
  }
  
  return items;
};

function rocDateToUnixTimestamp(rocDate: string) {
  // Format is YYYMMDD, e.g., 1120512
  const year = parseInt(rocDate.substring(0, 3), 10) + 1911;
  const month = parseInt(rocDate.substring(3, 5), 10) - 1; // 0-indexed
  const day = parseInt(rocDate.substring(5, 7), 10);
  return new Date(year, month, day).getTime();
}
