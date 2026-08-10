// testAES.cpp : Defines the entry point for the console application.
//


#include "stdafx.h"
#include <stdio.h>
#include <stdlib.h>
#include <tchar.h>
#include <windows.h>



typedef void  (__stdcall  CALLBACK* LPFNDLLFUNC1)(char* InvoiceNumber, char* InvoiceDate, char* InvoiceTime, char* RandomNumber, double SalesAmount, double TaxAmount,double TotalAmount, char* BuyerIdentifier, char* RepresentIdentifier, char* SellerIdentifier, char* BusinessIdentifier,char*** productArray,char* AESKey,char *output,int *errorCode);
typedef void  (__stdcall  CALLBACK* LPFNDLLFUNC2)(char *cipherText,char *key,char *out);

LPFNDLLFUNC1 QRCodeINV;    // Function pointer
LPFNDLLFUNC2 Encrypt;    // Function pointer


int main(int argc, char* argv[])
{
	HINSTANCE   hInst   = LoadLibrary(_T("QRDLL.dll"));
	int rc;
	char out[78];
	char ***array;
	int *errorCode;
	array=(char ***)malloc(5);
	errorCode=(int *)malloc(sizeof(int));
	
	if(hInst)  
	{	
	//	Encrypt= GetProcAddress( hInst,"Encrypt"); 
		QRCodeINV = GetProcAddress( hInst,"QRCodeINV");  
				if (!QRCodeINV)
				{
					rc = GetLastError();
					FreeLibrary(hInst);
					printf("\n\terror %d\n",rc); 
				}

		QRCodeINV("AA12345678", "1001231", "150000", "1234", 1000000, 100, 100, "12345678", "87654321", "12344321", "43211234", "05D4A324ABAF4A570E64E572221E438B",out,errorCode);
		printf("ErrorCode:%d\n",*errorCode);
		printf("%s",out);
		
	}else
	{
		printf("\n\tload Libary fail\n");
	}
	free(array);
	free(errorCode);
	return 0;
}

