



typedef char*  (__cdecl CALLBACK* LPFNDLLFUNC1)(char* InvoiceNumber, char* InvoiceDate, char* InvoiceTime, char* RandomNumber, double SalesAmount, double TaxAmount,double TotalAmount, char* BuyerIdentifier, char* RepresentIdentifier, char* SellerIdentifier, char* BusinessIdentifier,char*** productArray,char* AESKey);
typedef char*  (__cdecl CALLBACK* LPFNDLLFUNC2)(char *cipherText,char *key);