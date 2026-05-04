
export interface RestaurantSettings {
  name: string;
  street: string;
  zipCode: string;
  city: string;
  siret: string;
  vatNumber: string;
  phone: string;
  logo: string | null;
  primaryColor: string;
  rcs?: string;
  ape?: string;
  capital?: string;
  headquarters?: string;
}

export interface ClientInfo {
  companyName: string;
  address: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  covers: number;
  client: ClientInfo;
  description: string;
  amountHT10: number;
  amountHT20: number;
}

export interface InvoiceHistoryItem {
  id: number;
  invoiceNumber: string;
  clientName: string;
  totalTTC: number;
  date: string;
  createdAt: string;
  fullData?: {
    settings: RestaurantSettings;
    invoiceData: InvoiceData;
  };
}
