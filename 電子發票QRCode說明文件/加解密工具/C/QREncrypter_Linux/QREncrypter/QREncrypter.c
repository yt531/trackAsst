#include <stdio.h>
#include <time.h>
#include "aes.c"
#include "aesenc.c"
#include "b64.c"
//#include "aes.h"

void Encrypt(char *cipherText,char *key,char *out);
void encodeB64(BYTE * input,char *output,int inputLength);
void convert32bitHexToByte(char* hex,BYTE *byte);
void itoa(int value,char *string,int radix);
void GetKeyIV(char*	key, BYTE Key[AES_USER_KEY_LEN],BYTE IV[AES_BLOCK_LEN]);
void encodeblock( unsigned char in[3], unsigned char out[4], int len );
void QRCodeINV(char* InvoiceNumber, char* InvoiceDate, char* InvoiceTime, char* RandomNumber, double SalesAmount, double TaxAmount,
            double TotalAmount, char* BuyerIdentifier, char* RepresentIdentifier, char* SellerIdentifier, char* BusinessIdentifier,char*** productArray,char* AESKey,char *output,int *errorCode);

int checkInput(char* InvoiceNumber, char* InvoiceDate, char* InvoiceTime, char* RandomNumber, double SalesAmount, double TaxAmount,
            double TotalAmount, char* BuyerIdentifier, char* RepresentIdentifier, char* SellerIdentifier, char* BusinessIdentifier,char*** productArray);

struct ProcessBuffer{
	char buffer[1024];
	struct ProcessBuffer *next;
};

void encodeB64(BYTE * input,char *output,int inputLength)
{
	int i=0,j=0,index=0,outputLength=0;
	BYTE *result;
//	inputLength=strlen(input);
	if(inputLength%3==0)
		outputLength=(inputLength/3)*4;
	else
		outputLength=((inputLength+3-inputLength%3)/3)*4;

	result=(BYTE *)malloc(outputLength+1);
	memset(result,0,outputLength);
	for(i=0;i<inputLength;i+=3)
	{
		unsigned char in[3], out[4];
		if(i+3<=inputLength)
		{
			in[0]=input[i];
			in[1]=input[i+1];
			in[2]=input[i+2];
			encodeblock(in,out,3);
		}
		else
		{
			for(j=i;j<inputLength;j++)
				in[j-i]=input[j];
			for(j;j<(inputLength+3-inputLength%3);j++)
				in[j-i]=0;
			encodeblock(in,out,inputLength%3);
		}	
		if(strlen(result)!=0)
			strncat(result,out,4);
		else
			strncpy(result,out,4);
	}

	memset(output,0,outputLength+1);
	memcpy(output,result,outputLength);
	free(result);
}

int checkInput(char* InvoiceNumber, char* InvoiceDate, char* InvoiceTime, char* RandomNumber, double SalesAmount, double TaxAmount,
            double TotalAmount, char* BuyerIdentifier, char* RepresentIdentifier, char* SellerIdentifier, char* BusinessIdentifier,char*** productArray)
{
	if(strlen(InvoiceNumber)!=10)
		return -1;
	if(strlen(InvoiceDate)!=7)
		return -2;
	if(strlen(InvoiceTime)<=0)
		return -3;
	if(strlen(RandomNumber)!=4)
		return -4;
	if(SalesAmount<0)
		return -5;
	if(TaxAmount <0)
		return -6;
	if(TotalAmount<=0)
		return -7;
	if(strlen(BuyerIdentifier)!=8)
		return -8;
	if(strlen(RepresentIdentifier)<=0)
		return -9;
	if(strlen(SellerIdentifier)!=8)
		return -10;
	if(strlen(BusinessIdentifier)<=0)
		return -11;

	return 0;
}

void convert32bitHexToByte(char* hex,BYTE *byte)
{

	int i=0,err=0,by;
	BYTE result[16], *cp,ch;
	
	cp=(unsigned char *)hex;

	 while(i < 32 && *cp)        // the maximum key length is 16 bytes and
    {                           // hence at most 32 hexadecimal digits
        ch = toupper(*cp++);    // process a hexadecimal digit
        if(ch >= '0' && ch <= '9')
            by = (by << 4) + ch - '0';
        else if(ch >= 'A' && ch <= 'F')
            by = (by << 4) + ch - 'A' + 10;
        else                    // error if not hexadecimal
        {
            printf("key must be in hexadecimal notation\n");
            err = -2; 
        }

        // store a key byte for each pair of hexadecimal digits
        if(i++ & 1)
            result[i / 2 - 1] = by & 0xff;
    }

	if(*cp)
    {
        printf("The key value is too long\n");
        err = -3; 
    }
    else if(i < 16 || (i & 15))
    {
        printf("The key length must be 32, 48 or 64 hexadecimal digits\n");
        err = -4;
    }
	for(i=0;i<16;i++)
		*(byte+i)=result[i];
}


void GetKeyIV(char*	key,	BYTE	Key[AES_USER_KEY_LEN],	BYTE	IV[AES_BLOCK_LEN])
{
	convert32bitHexToByte(key,Key);
	convert32bitHexToByte("0EDF25C93A28D7B5FF5E45DA42F8A1B8",IV);
}
void convert8bitHex(double inputNumber,char *hexChar)
{
	char hex[9];
	char padHex[9];
	int i,j;
	itoa((int)inputNumber,hex,16);
	for(i=8,j=strlen(hex);j>=0;i--,j--)
	{
		padHex[i]=hex[j];
	}
	for(i;i>=0;i--)
		padHex[i]='0';
	strcpy(hexChar,padHex);
}
void itoa(int num, char *string, int base) { 
    sprintf(string, "%08x", num);
} 
void  QRCodeINV(char* InvoiceNumber, char* InvoiceDate, char* InvoiceTime, char* RandomNumber, double SalesAmount, double TaxAmount,
            double TotalAmount, char* BuyerIdentifier, char* RepresentIdentifier, char* SellerIdentifier, char* BusinessIdentifier,char*** productArray,char* AESKey,char *output,int *errorCode)
 {
	char result[78];
	char hex[9];

	const char *cipherText;
	const char *out;
	
	int checkResult=checkInput( InvoiceNumber,  InvoiceDate,  InvoiceTime,  RandomNumber,  SalesAmount,  TaxAmount, TotalAmount,  BuyerIdentifier, RepresentIdentifier, SellerIdentifier, BusinessIdentifier, productArray);
	if(checkResult!=0)
	{
		*errorCode=checkResult;
		memset(output,0,1);
		return;
	}
	else
		*errorCode=0;
	
	out=(char*)malloc(25);
	memset(out,0,25);
	cipherText=(char *)malloc(15);
	memset(cipherText,0,15);
	strcpy(cipherText,InvoiceNumber);
	strcat(cipherText,RandomNumber);
	
	strcpy(result,InvoiceNumber);

	strcat(result,InvoiceDate);
	
	strcat(result,RandomNumber);

	convert8bitHex(SalesAmount,hex);
	strcat(result,hex);

	convert8bitHex(TotalAmount,hex);
	strcat(result,hex);

	strcat(result,BuyerIdentifier);

	strcat(result,SellerIdentifier);
	
	Encrypt(cipherText,AESKey,out);	
	strcat(result,out);
	strcpy(output,result);
	free(cipherText);
	free(out);
 }
void  Encrypt(char *cipherText,char *key,char *encryptOut)
{
	AES_ALG_INFO	AlgInfo;
	BYTE Key[16];
	BYTE IV[16];
	BYTE SrcData[1024+32];
	BYTE DstData[1024+32];
	char* result;	
	char* encodingResult;
	int len=strlen(cipherText),i=0,bufferCount=0,encodInputLength=0;
	DWORD keyLen=16;
	DWORD IVLen=16;
	DWORD DstLen=1024;
	DWORD SrcLen=14;
	struct ProcessBuffer *buffer;
	struct ProcessBuffer *ptr;
	struct ProcessBuffer *finalBuffer;
	GetKeyIV(key,Key,IV);
	AES_SetAlgInfo(AI_CBC, AI_PKCS_PADDING, IV, &AlgInfo);
	AES_EncKeySchedule(Key, keyLen, &AlgInfo);
	AES_EncInit(&AlgInfo);
	
	buffer=(struct ProcessBuffer*)malloc(sizeof(struct ProcessBuffer));
	buffer->next=NULL;
	do
	{
		memset(SrcData,0,1024+32);
		memset(DstData,0,1024+32);
		memcpy(SrcData,cipherText+i,strlen(cipherText));
		AES_EncUpdate(&AlgInfo, SrcData, SrcLen, DstData, &DstLen);
		
		if(i==0)
		{
			memset(buffer->buffer,0,1024);
			memcpy(buffer->buffer,DstData,DstLen);
		}
		else
		{
			struct ProcessBuffer * newBuffer;
			newBuffer=(struct ProcessBuffer *)malloc(sizeof(struct ProcessBuffer));
			newBuffer->next=NULL;
			memset(newBuffer->buffer,0,1024);
			memcpy(newBuffer->buffer,DstData,DstLen);
			ptr=buffer;
			
			while(ptr->next!=NULL)
				ptr=ptr->next;
			ptr->next=newBuffer;
		}		
		i+=1024;
	}while(i<strlen(cipherText));
	DstLen=1024;
	finalBuffer=(struct ProcessBuffer *)malloc(sizeof(struct ProcessBuffer));
	finalBuffer->next=NULL;
	AES_EncFinal(&AlgInfo, DstData, &DstLen);
	memset(finalBuffer->buffer,0,1024);
	memcpy(finalBuffer->buffer,DstData,1024);
	
	ptr=buffer;
	while(ptr->next!=NULL)
	{
		bufferCount++;
		ptr=ptr->next;
	}
	ptr->next=finalBuffer;
	bufferCount++;
	result=(char *)malloc(bufferCount*1024+1);
	memset(result,0,bufferCount*1024+1);
	
	memcpy(result,buffer->buffer,1024);
	ptr=buffer->next;
	i=0;
	while(ptr!=NULL)
	{
		//strcat(result,ptr->buffer);
		memcpy(result+i*1024,ptr->buffer,1024);
		i++;
		ptr=ptr->next;
	}
	//strcat(result,"'\0'");

	//encodInputLength=getLength(result);
	encodInputLength=16;
	if(encodInputLength==0)
		encodingResult=(char*)malloc(encodInputLength/3*4+1);
	else
		encodingResult=(char*)malloc(((encodInputLength+3-encodInputLength%3)/3)*4+1);
	encodeB64(result,encodingResult,encodInputLength);

	//out=(char*)malloc(strlen(encodingResult)+1);
	memset(encryptOut,0,strlen(encodingResult)+1);
	//strcpy(encryptOut,encodingResult);
	memcpy(encryptOut,encodingResult,strlen(encodingResult));


	free(result);
	free(encodingResult);
	while(buffer!=NULL)
	{
		ptr=buffer->next;
		free(buffer);
		buffer=ptr;
	}
}
void bufferToVar(char *src,char *des)
{
	strncpy(des,src,50);
	des[strlen(des)-1]='\0';
}
int getLength(BYTE * input)
{
	int i=0, inputLength=0;
	while((*(input+i)!='\0'||*(input+i+1)!='\0')){
		inputLength++;
		i++;
	}
	return inputLength;
}
int main(int argc, char * argv[])
{
	char *result;
	int *errorCode;
	char InvoiceNumber[50],InvoiceDate[50],InvoiceTime[50],RandomNumber[50],BuyerIdentifier[50],RepresentIdentifier[50],SellerIdentifier[50],BusinessIdentifier[50],***productArray[50],AESKey[50],output[50];
	double SalesAmount,TaxAmount,TotalAmount;
	char Sales[50],Tax[50],Total[50],InNumber[50],Invoice[50],INTIME[50],RANNUMBER[50],BUYER[50],REPRESENT[50],SELLER[50],BUSINESS[50],SKEY[50];
	
	result=(char *)malloc(sizeof(char)*79);
	errorCode=(int *)malloc(sizeof(int));
	if(argc==2)
	{
		FILE * input;
		input=fopen(argv[1],"r");

		fgets (InNumber,50,input);
		bufferToVar(InNumber,InvoiceNumber);

		fgets (Invoice,50,input);
		bufferToVar(Invoice,InvoiceDate);

		fgets (INTIME,50,input);
		bufferToVar(INTIME,InvoiceTime);

		fgets (RANNUMBER,50,input);
		bufferToVar(RANNUMBER,RandomNumber);

		fgets (Sales,100,input);
		SalesAmount = atof ( Sales );

		fgets (Tax,100,input);
		TaxAmount = atof ( Tax );

		fgets (Total,100,input);
		TotalAmount = atof ( Total );

		fgets (BUYER,50,input);
		bufferToVar(BUYER,BuyerIdentifier);

		fgets (REPRESENT,50,input);
		bufferToVar(REPRESENT,RepresentIdentifier);

		fgets (SELLER,50,input);
		bufferToVar(SELLER,SellerIdentifier);

		fgets (BUSINESS,50,input);
		bufferToVar(BUSINESS,BusinessIdentifier);

		fgets (SKEY,50,input);
		bufferToVar(SKEY,AESKey);

		QRCodeINV(InvoiceNumber, InvoiceDate, InvoiceTime, RandomNumber, SalesAmount, TaxAmount,TotalAmount, BuyerIdentifier, RepresentIdentifier, SellerIdentifier,  BusinessIdentifier, NULL, AESKey,output,errorCode);
		//fprintf(stderr,"%d",errorCode);
		if(*errorCode==0)
			fprintf(stdout,"%s",output);
		else
		  fprintf(stderr,"%d",*errorCode);
		fclose(input);
	}
	else
	{
		fprintf(stderr,"Usage: QREncryter.exe [path]\n");
	}

	
}
